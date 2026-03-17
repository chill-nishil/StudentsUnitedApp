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
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

type ChatRoomItem = {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageSender: string;
  lastMessageTime: any;
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

export default function ChatRoomsScreen() {
  const auth = getAuth();

  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [rooms, setRooms] = useState<ChatRoomItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [lastReadByClub, setLastReadByClub] = useState<Record<string, any>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

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
          lastMessageTime: data.lastMessageTime || null
        };
      });

      list.sort((a, b) => {
        const aTime =
          a.lastMessageTime && typeof a.lastMessageTime?.toDate === "function"
            ? a.lastMessageTime.toDate().getTime()
            : 0;

        const bTime =
          b.lastMessageTime && typeof b.lastMessageTime?.toDate === "function"
            ? b.lastMessageTime.toDate().getTime()
            : 0;

        return bTime - aTime;
      });

      setRooms(list);
      setLoading(false);
    });

    return unsub;
  }, [currentUid]);

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

      const clubRef = await addDoc(collection(db, "clubs"), {
        name: normalizedName,
        presidentId: currentUid,
        members: [currentUid],
        joinRequests: []
      });

      const userRef = doc(db, "users", currentUid);

      await updateDoc(userRef, {
        position: "President",
        clubIds: arrayUnion(clubRef.id),
        clubNames: arrayUnion(normalizedName),
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

  return (
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

              return (
                <Pressable style={styles.chatRow} onPress={() => openChat(item)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.textWrap}>
                    <Text numberOfLines={1} style={styles.chatName}>
                      {item.name}
                    </Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white"
  },
  header: {
    backgroundColor: "#7b97d4",
    paddingTop: 30,
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
  avatarText: {
    color: "white",
    fontSize: 20,
    fontWeight: "700"
  },
  textWrap: {
    flex: 1
  },
  chatName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827"
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
    bottom: 50
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
  }
});