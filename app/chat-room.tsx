import { db } from "@/FirebaseConfig";
import { router, useLocalSearchParams } from "expo-router";
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
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
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

export default function ChatScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();

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
  const [expandedReactions, setExpandedReactions] = useState<
  Record<string, string[]>
  >({});
  const cancelEmojiReaction = () => {
  emojiInputRef.current?.blur();
  Keyboard.dismiss();
  setShowEmojiPicker(false);
  setActiveMessageId(null);
  setEmojiInput("");
};

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
    if (!uid) return;

    async function loadUser() {
      const q = query(collection(db, "users"), where("uid", "==", uid));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const data = snap.docs[0].data();
        setUserName(data.name);
        setPosition(data.position);
        setClubName(data.clubName || "Club Chat");

        if (!data.clubId) {
          router.replace(`/join-club?uid=${uid}`);
          return;
        }

        setUserClubId(data.clubId);
      }
    }

    loadUser();
  }, [uid]);

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


  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>

        <View style={styles.container}>
          {/* CLUB NAME HEADER */}
          <Text style={styles.clubHeader}>
            {clubName}
          </Text>

          {/* USER INFO SUBHEADER */}
          <Text style={styles.userHeader}>
            {userName} · {position}
          </Text>

          <Pressable
            style={styles.openCalendarButton}
            onPress={() => router.push("/calendar")}
          >
            <Text style={styles.openCalendarText}>Add Event</Text>
          </Pressable>

          <FlatList
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 16 }}

            renderItem={({ item }) => {
            const isMine = item.senderName === userName;
            const myReactionEmoji = item.reactions &&
              Object.entries(item.reactions).find(([_, users]) => users.includes(userName))?.[0];

            return (
              <View
                style={[
                  styles.messageGroup,
                  isMine ? styles.alignRight : styles.alignLeft
                ]}
              >
                <View
                  style={[
                    styles.message,
                    isMine ? styles.myMessage : styles.otherMessage
                  ]}
                >
                  <Text style={styles.sender}>
                    {item.senderName} · {item.position}
                  </Text>
                  <Text
                    style={isMine ? styles.myMessageText : styles.otherMessageText}
                  >
                    {item.message}
                  </Text>
                </View>

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
                    {showEmojiPicker && activeMessageId === item.id
                      ? "Select an emoji from keyboard"
                      : "😊 React"}
                  </Text>
                </Pressable>

              {item.reactions &&
                Object.entries(item.reactions)
                  .filter(([_, users]) => users.length > 0)
                  .map(([emoji, users]) => {
                    const expandedForMessage = expandedReactions[item.id] || [];
                    const isExpanded = expandedForMessage.includes(emoji);

                    const myReactionEmoji =
                      item.reactions &&
                      Object.entries(item.reactions).find(([_, u]) =>
                        u.includes(userName)
                      )?.[0];

                    const hasReacted = myReactionEmoji === emoji;

                    return (
                    <View key={emoji} style={styles.reactionContainer}>
                      <View style={styles.reactionTopRow}>
                        <Pressable
                          onPress={() => {
                            setExpandedReactions(prev => {
                              const next = { ...prev };
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
                          <View
                            style={[
                              styles.reactionBubble,
                              hasReacted && styles.reactionBubbleActive
                            ]}
                          >
                            <Text>
                              {emoji} {users.length}
                            </Text>
                          </View>
                        </Pressable>

                        {hasReacted && (
                          <Pressable
                            style={styles.removeReaction}
                            onPress={() => handleReaction(item.id, emoji)}
                          >
                            <Text style={styles.removeReactionText}>×</Text>
                          </Pressable>
                        )}
                      </View>

                      {isExpanded && (
                        <View style={styles.reactionBottomRow}>
                          <Text style={styles.reactionNames}>
                            {users.join(", ")}
                          </Text>

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
          )}}/>

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
      </TouchableWithoutFeedback>
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
    backgroundColor: "white",
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
}

});
