import BottomNav from "@/components/BottomNav";
import { db } from "@/FirebaseConfig";
import { router } from "expo-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ChatRoomItem = {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageSender: string;
  lastMessageTime: any;
  groupIconBase64?: string | null;
};

function formatChatTime(value: any): string {
  try {
    const d =
      value && typeof value?.toDate === "function"
        ? value.toDate()
        : value instanceof Date
        ? value
        : null;

    if (!d || isNaN(d.getTime())) return "";

    const now = new Date();

    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (sameDay) {
      return d.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      });
    }

    return d.toLocaleDateString([], {
      month: "numeric",
      day: "numeric"
    });
  } catch {
    return "";
  }
}

function generateClubCode(length = 6): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

export default function ChatRoomsScreen() {
  const auth = getAuth();

  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [rooms, setRooms] = useState<ChatRoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastReadByClub, setLastReadByClub] = useState<Record<string, any>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [pinnedClubIds, setPinnedClubIds] = useState<string[]>([]);
  const [showCreateClubModal, setShowCreateClubModal] = useState(false);
  const [newClubName, setNewClubName] = useState("");
  const [creatingClub, setCreatingClub] = useState(false);

  useEffect(() => {
    if (!currentUid || rooms.length === 0) {
      setUnreadCounts({});
      return;
    }

    const unsubscribers: (() => void)[] = [];

    rooms.forEach(room => {
      const lastReadTime = lastReadByClub[room.id];

      let chatsQuery;

      if (lastReadTime) {
        chatsQuery = query(
          collection(db, "chats"),
          where("clubId", "==", room.id),
          where("createdAt", ">", lastReadTime)
        );
      } else {
        chatsQuery = query(
          collection(db, "chats"),
          where("clubId", "==", room.id)
        );
      }

      const unsub = onSnapshot(chatsQuery, snap => {
        let count = 0;

        snap.docs.forEach(d => {
          const data = d.data();

          if (data.senderUid !== currentUid) {
            count += 1;
          }
        });

        setUnreadCounts(prev => ({
          ...prev,
          [room.id]: count
        }));
      });

      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [currentUid, rooms, lastReadByClub]);

  useEffect(() => {
    if (!currentUid) return;

    const userRef = doc(db, "users", currentUid);

    const unsub = onSnapshot(userRef, snap => {
      if (!snap.exists()) return;

      const data = snap.data();
      setLastReadByClub(data.lastReadByClub || {});
      setPinnedClubIds(Array.isArray(data.pinnedClubIds) ? data.pinnedClubIds : []);
    });

    return unsub;
  }, [currentUid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setCurrentUid(user ? user.uid : null);
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (!currentUid) return;

    const q = query(
      collection(db, "clubs"),
      where("members", "array-contains", currentUid)
    );

    const unsub = onSnapshot(q, snap => {
      const list: ChatRoomItem[] = snap.docs.map(d => {
        const data = d.data();

        return {
          id: d.id,
          name: data.name || "Club Chat",
          lastMessage: data.lastMessage || "",
          lastMessageSender: data.lastMessageSender || "",
          lastMessageTime: data.lastMessageTime || null,
          groupIconBase64: data.groupIconBase64 || null
        };
      });

      list.sort((a, b) => {
        const aIsPinned = pinnedClubIds.includes(a.id);
        const bIsPinned = pinnedClubIds.includes(b.id);

        const aTime =
          a.lastMessageTime && typeof a.lastMessageTime?.toDate === "function"
            ? a.lastMessageTime.toDate().getTime()
            : 0;

        const bTime =
          b.lastMessageTime && typeof b.lastMessageTime?.toDate === "function"
            ? b.lastMessageTime.toDate().getTime()
            : 0;

        if (aIsPinned && !bIsPinned) return -1;
        if (!aIsPinned && bIsPinned) return 1;

        return bTime - aTime;
      });

      setRooms(list);
      setLoading(false);
    });

    return unsub;
  }, [currentUid, pinnedClubIds]);

  function openChat(room: ChatRoomItem) {
    router.push({
      pathname: "/chat-room",
      params: {
        clubId: room.id,
        clubName: room.name
      }
    });
  }

  function renderPreview(item: ChatRoomItem) {
    if (!item.lastMessage) return "No messages yet";
    if (!item.lastMessageSender) return item.lastMessage;
    return `${item.lastMessageSender}: ${item.lastMessage}`;
  }

  async function handleCreateClub() {
    if (!currentUid || creatingClub) return;

    const normalizedName = newClubName.trim().toUpperCase();

    if (!normalizedName) {
      Alert.alert("Error", "Please enter a club name.");
      return;
    }

    try {
      setCreatingClub(true);

      const existingClubQuery = query(
        collection(db, "clubs"),
        where("name", "==", normalizedName)
      );

      const existingClubSnap = await getDocs(existingClubQuery);

      if (!existingClubSnap.empty) {
        Alert.alert("Error", "A club with that name already exists.");
        setCreatingClub(false);
        return;
      }

      let clubCode = "";
      let codeExists = true;

      while (codeExists) {
        clubCode = generateClubCode();

        const codeQuery = query(
          collection(db, "clubs"),
          where("clubCode", "==", clubCode)
        );

        const codeSnap = await getDocs(codeQuery);
        codeExists = !codeSnap.empty;
      }

      const clubRef = await addDoc(collection(db, "clubs"), {
        name: normalizedName,
        clubCode: clubCode,
        presidentId: currentUid,
        members: [currentUid],
        joinRequests: []
      });

      const userRef = doc(db, "users", currentUid);

      await updateDoc(userRef, {
        position: "President",
        clubIds: arrayUnion(clubRef.id),
        clubNames: arrayUnion(normalizedName),
        clubMemberships: arrayUnion({
          clubId: clubRef.id,
          position: "President"
        }),
        [`lastReadByClub.${clubRef.id}`]: new Date()
      });

      setNewClubName("");
      setShowCreateClubModal(false);
      Alert.alert("Success", "Club created.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not create club.");
    } finally {
      setCreatingClub(false);
    }
  }

  async function pinRoom(room: ChatRoomItem) {
    if (!currentUid) return;

    const userRef = doc(db, "users", currentUid);
    const alreadyPinned = pinnedClubIds.includes(room.id);

    if (alreadyPinned) {
      return;
    }

    if (pinnedClubIds.length < 3) {
      await updateDoc(userRef, {
        pinnedClubIds: [...pinnedClubIds, room.id]
      });
      return;
    }

    const pinnedRooms = pinnedClubIds
      .map(id => rooms.find(roomItem => roomItem.id === id))
      .filter(Boolean) as ChatRoomItem[];

    Alert.alert(
      "Pinned chats full",
      "You can only pin 3 chats. Remove one and replace it.",
      [
        ...pinnedRooms.map(pinnedRoom => ({
          text: `Replace ${pinnedRoom.name}`,
          onPress: async () => {
            const updatedPinned = pinnedClubIds.filter(id => id !== pinnedRoom.id);
            updatedPinned.push(room.id);

            await updateDoc(userRef, {
              pinnedClubIds: updatedPinned
            });
          }
        })),
        {
          text: "Cancel",
          style: "cancel"
        }
      ]
    );
  }

  async function unpinRoom(room: ChatRoomItem) {
    if (!currentUid) return;

    const userRef = doc(db, "users", currentUid);
    const updatedPinned = pinnedClubIds.filter(id => id !== room.id);

    await updateDoc(userRef, {
      pinnedClubIds: updatedPinned
    });
  }

  function handleRoomLongPress(room: ChatRoomItem) {
    const isPinned = pinnedClubIds.includes(room.id);

    Alert.alert(
      room.name,
      isPinned ? "This chat is pinned." : "Pin this chat to keep it at the top.",
      [
        isPinned
          ? {
              text: "Unpin",
              onPress: () => unpinRoom(room)
            }
          : {
              text: "Pin",
              onPress: () => pinRoom(room)
            },
        {
          text: "Cancel",
          style: "cancel"
        }
      ]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#7b97d4" }} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Students United Chat Rooms</Text>
        </View>

        {loading ? (
          <Text style={styles.statusText}>Loading chats...</Text>
        ) : (
          <>
            {rooms.length === 0 && (
              <Text style={styles.noClubMessage}>Enroll in a club!</Text>
            )}

            <FlatList
              data={rooms}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const unreadCount = unreadCounts[item.id] || 0;
                const unread = unreadCount > 0;
                const isPinned = pinnedClubIds.includes(item.id);

                return (
                  <Pressable
                    style={styles.chatRow}
                    onPress={() => openChat(item)}
                    onLongPress={() => handleRoomLongPress(item)}
                  >
                    {item.groupIconBase64 ? (
                      <Image
                        source={{ uri: `data:image/jpeg;base64,${item.groupIconBase64}` }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {item.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.textWrap}>
                      <View style={styles.nameRow}>
                        <Text numberOfLines={1} style={styles.chatName}>
                          {item.name}
                        </Text>

                        {isPinned && (
                          <Text style={styles.pinIcon}>📌</Text>
                        )}
                      </View>

                      <Text numberOfLines={1} style={styles.previewText}>
                        {renderPreview(item)}
                      </Text>
                    </View>

                    <View style={styles.rightWrap}>
                      <Text style={[styles.timeText, unread && styles.unreadTimeText]}>
                        {formatChatTime(item.lastMessageTime)}
                      </Text>

                      {unread && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              }}
            />

            <View style={styles.floatingButtonsWrap}>
              <Pressable
                style={styles.floatingCreateButton}
                onPress={() => setShowCreateClubModal(true)}
              >
                <Text style={styles.floatingCreateButtonText}>Create Club</Text>
              </Pressable>

              <Pressable
                style={styles.floatingJoinButton}
                onPress={() => router.push("/join-club")}
              >
                <Text style={styles.floatingJoinButtonText}>Join Club</Text>
              </Pressable>
            </View>
          </>
        )}

        <Modal
          visible={showCreateClubModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!creatingClub) {
              setShowCreateClubModal(false);
            }
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Create Club</Text>

              <TextInput
                placeholder="Enter club name"
                placeholderTextColor="#6B7280"
                value={newClubName}
                onChangeText={setNewClubName}
                autoCapitalize="characters"
                style={styles.modalInput}
              />

              <Text style={styles.positionLabel}>Position</Text>
              <TextInput
                value="President"
                editable={false}
                style={[styles.modalInput, styles.disabledInput]}
              />

              <View style={styles.modalButtonsRow}>
                <Pressable
                  style={styles.modalCancelButton}
                  onPress={() => {
                    if (!creatingClub) {
                      setShowCreateClubModal(false);
                      setNewClubName("");
                    }
                  }}
                  disabled={creatingClub}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={styles.modalCreateButton}
                  onPress={handleCreateClub}
                  disabled={creatingClub}
                >
                  <Text style={styles.modalCreateText}>
                    {creatingClub ? "Creating..." : "Create Club"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
        <BottomNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    paddingBottom: 95
  },
  header: {
    backgroundColor: "#7b97d4",
    paddingTop: 18,
    paddingBottom: 16,
    paddingLeft: 18
  },
  headerTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "600"
  },
  statusText: {
    marginTop: 40,
    textAlign: "center",
    fontSize: 15,
    color: "#6B7280"
  },
  listContent: {
    paddingBottom: 180
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#d7e8f9"
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#7b97d4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12
  },
  avatarText: {
    color: "white",
    fontSize: 20,
    fontWeight: "700"
  },
  textWrap: {
    flex: 1
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  chatName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flexShrink: 1
  },
  pinnedTag: {
    marginLeft: 8,
    backgroundColor: "#FFF3CD",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  pinnedTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#8A6D3B"
  },
  previewText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 3
  },
  timeText: {
    fontSize: 12,
    color: "#6B7280"
  },
  unreadTimeText: {
    color: "#25D366",
    fontWeight: "600"
  },
  unreadBadge: {
    marginTop: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  unreadBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700"
  },
  rightWrap: {
    justifyContent: "flex-start",
    alignItems: "flex-end",
    minWidth: 62
  },
  floatingButtonsWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 95
  },
  floatingCreateButton: {
    backgroundColor: "white",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#7b97d4",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3
    },
    shadowOpacity: 0.15,
    shadowRadius: 6
  },
  floatingCreateButtonText: {
    color: "#7b97d4",
    fontSize: 16,
    fontWeight: "600"
  },
  floatingJoinButton: {
    backgroundColor: "#7b97d4",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3
    },
    shadowOpacity: 0.15,
    shadowRadius: 6
  },
  floatingJoinButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: 24
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 18
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center"
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    color: "#111827"
  },
  positionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6
  },
  disabledInput: {
    backgroundColor: "#F3F4F6",
    color: "#6B7280"
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  modalCancelButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center"
  },
  modalCancelText: {
    color: "#374151",
    fontWeight: "600"
  },
  modalCreateButton: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#7b97d4",
    alignItems: "center"
  },
  modalCreateText: {
    color: "white",
    fontWeight: "600"
  },
  noClubMessage: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 14,
    color: "#6B7280"
  },
  pinIcon: {
    marginLeft: 6,
    fontSize: 14
  },
  floatingGeneralCalendarButton: {
    backgroundColor: "#dbeafe",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#7b97d4",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3
    },
    shadowOpacity: 0.15,
    shadowRadius: 6
  },
  floatingGeneralCalendarButtonText: {
    color: "#224bc5",
    fontSize: 16,
    fontWeight: "600"
  }
});