import { db } from "@/FirebaseConfig";
import { router } from "expo-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  // TouchableWithoutFeedback,
  View
} from "react-native";

type Message = {
  id: string;
  message: string;
  senderName: string;
  position: string;
  createdAt: any;
  reactions?: {
    [emoji: string]: string[];
  };
};

// ADDED: date helpers
function isValidDate(d: any): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

function toDateSafe(createdAt: any): Date | null {
  if (!createdAt) return null;

  if (typeof createdAt?.toDate === "function") {
    const d = createdAt.toDate();
    return isValidDate(d) ? d : null;
  }

  if (createdAt instanceof Date) return isValidDate(createdAt) ? createdAt : null;

  if (typeof createdAt === "number") {
    const d = new Date(createdAt);
    return isValidDate(d) ? d : null;
  }

  if (typeof createdAt === "string") {
    const d = new Date(createdAt);
    return isValidDate(d) ? d : null;
  }

  return null;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayDiffFromToday(d: Date): number {
  const today = startOfDay(new Date()).getTime();
  const day = startOfDay(d).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((day - today) / msPerDay);
}

function formatDayHeader(d: Date): string {
  const diff = dayDiffFromToday(d);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

export default function ChatScreen() {
  const auth = getAuth();
  const [currentUid, setCurrentUid] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [userName, setUserName] = useState("");
  const [position, setPosition] = useState("");
  const [clubName, setClubName] = useState("");
  const [userClubId, setUserClubId] = useState<string | null>(null);

  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiInput, setEmojiInput] = useState("");
  const emojiInputRef = useRef<TextInput>(null);
  const [expandedReactions, setExpandedReactions] = useState<Record<string, string[]>>({});
  const cancelEmojiReaction = () => {
    emojiInputRef.current?.blur();
    Keyboard.dismiss();
    setShowEmojiPicker(false);
    setActiveMessageId(null);
    setEmojiInput("");
  };

  const [isPresident, setIsPresident] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [requestUsers, setRequestUsers] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setCurrentUid(user ? user.uid : null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      if (showEmojiPicker) {
        setShowEmojiPicker(false);
        setActiveMessageId(null);
        setEmojiInput("");
      }
    });

    return () => sub.remove();
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!currentUid) return;

    const q = query(collection(db, "users"), where("uid", "==", currentUid));

    const unsub = onSnapshot(q, snap => {
      if (snap.empty) return;

      const data = snap.docs[0].data();

      setUserName(data.name);
      setPosition(data.position);
      setClubName(data.clubName || "Club Chat");

      if (!data.clubId) {
        router.replace(`/join-club?uid=${currentUid}`);
      } else {
        setUserClubId(data.clubId);
      }
    });

    return unsub;
  }, [currentUid]);

  useEffect(() => {
    if (!userClubId) return;
    const q = query(
      collection(db, "chats"),
      where("clubId", "==", userClubId),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, snapshot => {
      const list: Message[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          message: data.message,
          senderName: data.senderName,
          position: data.position,
          createdAt: data.createdAt,
          reactions: data.reactions || {}
        };
      });
      setMessages(list);
    });

    return unsub;
  }, [userClubId]);

  useEffect(() => {
    if (!userClubId || !currentUid) return;

    const clubRef = doc(db, "clubs", userClubId);

    const unsub = onSnapshot(clubRef, snap => {
      if (!snap.exists()) return;

      const data = snap.data();

      setIsPresident(data.presidentId === currentUid);

      const requests = data.joinRequests || [];

      if (requests.length > 0) {
        getDocs(query(collection(db, "users"), where("uid", "in", requests))).then(usersSnap => {
          setRequestUsers(usersSnap.docs.map(d => d.data()));
        });
      } else {
        setRequestUsers([]);
      }
    });

    return unsub;
  }, [userClubId, currentUid]);

  async function acceptJoinRequest(requestUid: string) {
    if (!userClubId) return;

    const clubRef = doc(db, "clubs", userClubId);
    const userRef = doc(db, "users", requestUid);

    await updateDoc(clubRef, {
      members: arrayUnion(requestUid),
      joinRequests: arrayRemove(requestUid)
    });

    await updateDoc(userRef, {
      clubId: userClubId,
      clubName: clubName
    });
  }

  async function rejectJoinRequest(requestUid: string) {
    if (!userClubId) return;

    const clubRef = doc(db, "clubs", userClubId);

    await updateDoc(clubRef, {
      joinRequests: arrayRemove(requestUid)
    });
  }

  async function sendMessage() {
    if (!input.trim() || !userName || !userClubId) return;

    await addDoc(collection(db, "chats"), {
      message: input,
      senderName: userName,
      position: position,
      clubId: userClubId,
      createdAt: serverTimestamp(),
      reactions: {}
    });

    setInput("");
  }

  async function handleReaction(messageId: string, emoji: string) {
    const messageRef = doc(db, "chats", messageId);
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const updates: Record<string, any> = {};

    const reactions = message.reactions || {};

    // Remove user from any existing reaction
    Object.keys(reactions).forEach(existingEmoji => {
      const users = reactions[existingEmoji];
      if (users.includes(userName)) {
        updates[`reactions.${existingEmoji}`] = arrayRemove(userName);
      }
    });

    const currentUsers = reactions[emoji] || [];

    // Toggle logic
    if (!currentUsers.includes(userName)) {
      updates[`reactions.${emoji}`] = arrayUnion(userName);
    }

    await updateDoc(messageRef, updates);

    setShowEmojiPicker(false);
    setActiveMessageId(null);
  }

  const EMOJI_REGEX = /^\p{Extended_Pictographic}$/u;

  const isSingleEmoji = (text: string): boolean => {
    return EMOJI_REGEX.test(text);
  };

  // ADDED: format time for display next to React
  const formatTime = (createdAt: any): string => {
    try {
      const d =
        createdAt && typeof createdAt?.toDate === "function"
          ? createdAt.toDate()
          : createdAt instanceof Date
            ? createdAt
            : null;

      if (!d || isNaN(d.getTime())) return "";
      return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      {/* <TouchableWithoutFeedback onPress={Keyboard.dismiss}> */}

      <View style={styles.container}>
        {/* CLUB NAME HEADER */}
        <Text style={styles.clubHeader}>{clubName}</Text>

        {/* USER INFO SUBHEADER */}
        <Text style={styles.userHeader}>
          {userName} · {position}
        </Text>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}>
          <Pressable style={styles.openCalendarButton} onPress={() => router.push("/calendar")}>
            <Text style={styles.openCalendarText}>Add Event</Text>
          </Pressable>

          {isPresident && (
            <Pressable style={styles.openCalendarButton} onPress={() => setShowRequestsModal(true)}>
              <Text style={styles.openCalendarText}>Join Requests</Text>
            </Pressable>
          )}
        </View>

        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 16 }}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => {
            const isMine = item.senderName === userName;
            const timeLabel = formatTime(item.createdAt);

            // ADDED: date header logic
            const curDate = toDateSafe(item.createdAt);
            const prev = index > 0 ? messages[index - 1] : null;
            const prevDate = prev ? toDateSafe(prev.createdAt) : null;
            const showDayHeader = !!curDate && (!prevDate || !sameDay(curDate, prevDate));

            const myReactionEmoji =
              item.reactions &&
              Object.entries(item.reactions).find(([_, users]) => users.includes(userName))?.[0];

            return (
              <View>
                {showDayHeader && (
                  <View style={styles.dayHeaderWrap}>
                    <Text style={styles.dayHeaderText}>{formatDayHeader(curDate as Date)}</Text>
                  </View>
                )}

                <View style={[styles.messageGroup, isMine ? styles.alignRight : styles.alignLeft]}>
                  <View style={[styles.message, isMine ? styles.myMessage : styles.otherMessage]}>
                    <Text style={styles.sender}>
                      {item.senderName} · {item.position}
                    </Text>
                    <Text style={isMine ? styles.myMessageText : styles.otherMessageText}>{item.message}</Text>
                  </View>

                  <View style={styles.reactRow}>
                    <Pressable
                      style={styles.reactButton}
                      onPress={() => {
                        setActiveMessageId(item.id);
                        setShowEmojiPicker(true);
                        setTimeout(() => {
                          emojiInputRef.current?.focus();
                        }, 50);
                      }}
                    >
                      <Text style={styles.reactText}>
                        {showEmojiPicker && activeMessageId === item.id ? "Select an emoji from keyboard" : "😊 React"}
                      </Text>
                    </Pressable>

                    {!!timeLabel && <Text style={styles.reactTimeText}>{timeLabel}</Text>}
                  </View>

                  {item.reactions &&
                    Object.entries(item.reactions)
                      .filter(([_, users]) => users.length > 0)
                      .map(([emoji, users]) => {
                        const expandedForMessage = expandedReactions[item.id] || [];
                        const isExpanded = expandedForMessage.includes(emoji);

                        const myReactionEmoji2 =
                          item.reactions &&
                          Object.entries(item.reactions).find(([_, u]) => u.includes(userName))?.[0];

                        const hasReacted = myReactionEmoji2 === emoji;

                        return (
                          <View key={emoji} style={styles.reactionContainer}>
                            <View style={styles.reactionTopRow}>
                              <Pressable
                                onPress={() => {
                                  setExpandedReactions(prevState => {
                                    const next = { ...prevState };
                                    const current = next[item.id] || [];

                                    if (current.includes(emoji)) {
                                      next[item.id] = current.filter(e => e !== emoji);
                                    } else {
                                      next[item.id] = [...current, emoji];
                                    }

                                    return next;
                                  });
                                }}
                              >
                                <View style={[styles.reactionBubble, hasReacted && styles.reactionBubbleActive]}>
                                  <Text>
                                    {emoji} {users.length}
                                  </Text>
                                </View>
                              </Pressable>

                              {hasReacted && (
                                <Pressable style={styles.removeReaction} onPress={() => handleReaction(item.id, emoji)}>
                                  <Text style={styles.removeReactionText}>×</Text>
                                </Pressable>
                              )}
                            </View>

                            {isExpanded && (
                              <View style={styles.reactionBottomRow}>
                                <Text style={styles.reactionNames}>{users.join(", ")}</Text>

                                {!hasReacted && (
                                  <Pressable
                                    style={styles.addReactionButton}
                                    onPress={() => handleReaction(item.id, emoji)}
                                  >
                                    <Text style={styles.addReactionText}>+</Text>
                                  </Pressable>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                </View>
              </View>
            );
          }}
        />

        <Modal visible={showRequestsModal} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center" }}>
            <View style={{ backgroundColor: "white", margin: 20, padding: 16, borderRadius: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 12 }}>Join Requests</Text>

              {requestUsers.length === 0 && <Text>No pending join requests</Text>}

              <FlatList
                data={requestUsers}
                keyExtractor={item => item.uid}
                renderItem={({ item }) => (
                  <View style={{ marginBottom: 12 }}>
                    <Text>{item.name}</Text>

                    <View style={{ flexDirection: "row", marginTop: 6 }}>
                      <Pressable style={[styles.send, { marginRight: 8 }]} onPress={() => acceptJoinRequest(item.uid)}>
                        <Text style={styles.sendText}>Accept</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.send, { backgroundColor: "#9CA3AF" }]}
                        onPress={() => rejectJoinRequest(item.uid)}
                      >
                        <Text style={styles.sendText}>Reject</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              />

              <Pressable onPress={() => setShowRequestsModal(false)}>
                <Text style={{ textAlign: "center", marginTop: 12 }}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {showEmojiPicker && (
          <TextInput
            ref={emojiInputRef}
            value={emojiInput}
            onChangeText={text => {
              if (isSingleEmoji(text)) {
                handleReaction(activeMessageId as string, text);
                setEmojiInput("");
                setShowEmojiPicker(false);
              } else {
                // reject letters, numbers, symbols, multiple characters
                setEmojiInput("");
              }
            }}
            style={{ height: 0, width: 0 }}
          />
        )}

        {!showEmojiPicker && (
          <View style={styles.row}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type message here..."
              placeholderTextColor="black"
              style={styles.input}
            />
            <Pressable style={styles.send} onPress={sendMessage}>
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>
        )}
      </View>
      {/* </TouchableWithoutFeedback> */}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "white"
  },
  clubHeader: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4
  },
  userHeader: {
    textAlign: "center",
    fontSize: 14,
    marginBottom: 12,
    color: "#555"
  },

  // ADDED: date header styles
  dayHeaderWrap: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 6
  },
  dayHeaderText: {
    fontSize: 12,
    color: "#6B7280"
  },

  sender: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2
  },
  message: {
    padding: 10,
    borderRadius: 6,
    marginVertical: 4,
    backgroundColor: "#E5E5E5"
  },
  reactButton: {
    marginLeft: 6
  },
  reactText: {
    fontSize: 13,
    color: "#6B7280"
  },
  emojiRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    backgroundColor: "#F3F4F6",
    borderTopWidth: 1,
    borderColor: "#E5E7EB"
  },
  emoji: {
    fontSize: 24
  },
  row: {
    flexDirection: "row",
    marginTop: 10,
    alignItems: "center"
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: "white"
  },
  send: {
    height: 48,
    backgroundColor: "#7b97d4",
    paddingHorizontal: 20,
    justifyContent: "center",
    borderRadius: 8
  },
  sendText: {
    color: "white",
    fontWeight: "600"
  },
  openCalendarButton: {
    backgroundColor: "#7b97d4",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignSelf: "center",
    marginTop: 16
  },
  openCalendarText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600"
  },
  emojiPickerContainer: {
    height: 320,
    borderTopWidth: 1,
    borderColor: "#E5E7EB"
  },
  removeReaction: {
    marginLeft: 6,
    paddingHorizontal: 4
  },
  removeReactionText: {
    fontSize: 14,
    color: "#6B7280"
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#DBEAFE"
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#E5E5E5"
  },
  myMessageText: {
    color: "#000"
  },
  otherMessageText: {
    color: "#000"
  },
  messageGroup: {
    maxWidth: "80%",
    marginVertical: 6
  },
  alignRight: {
    alignSelf: "flex-end",
    alignItems: "flex-end"
  },
  alignLeft: {
    alignSelf: "flex-start",
    alignItems: "flex-start"
  },
  reactionNames: {
    marginLeft: 6,
    fontSize: 12,
    color: "#374151"
  },
  addReactionButton: {
    marginLeft: 6,
    paddingHorizontal: 6
  },
  addReactionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280"
  },
  reactionBubbleActive: {
    backgroundColor: "#7b97d4"
  },
  reactionBubble: {
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  reactionContainer: {
    marginLeft: 6,
    marginTop: 2
  },
  reactionTopRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  reactionBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2
  },

  // ADDED: layout + style for time next to React
  reactRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  reactTimeText: {
    marginLeft: 8,
    fontSize: 11,
    color: "#6B7280"
  }
});