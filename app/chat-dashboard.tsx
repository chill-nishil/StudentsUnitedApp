import { db } from "@/FirebaseConfig";
import { router } from "expo-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
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

function isUnread(lastMessageTime: any, lastReadTime: any): boolean {
  const messageDate =
    lastMessageTime && typeof lastMessageTime?.toDate === "function"
      ? lastMessageTime.toDate()
      : lastMessageTime instanceof Date
      ? lastMessageTime
      : null;

  const readDate =
    lastReadTime && typeof lastReadTime?.toDate === "function"
      ? lastReadTime.toDate()
      : lastReadTime instanceof Date
      ? lastReadTime
      : null;

  if (!messageDate) return false;
  if (!readDate) return true;

  return messageDate.getTime() > readDate.getTime();
}

export default function ChatRoomsScreen() {
  const auth = getAuth();

  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [rooms, setRooms] = useState<ChatRoomItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [lastReadByClub, setLastReadByClub] = useState<Record<string, any>>({});

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

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

  return (
    <View style={styles.container}>

      {/* WhatsApp style header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Students United Chats</Text>
      </View>

      {loading ? (
        <Text style={styles.statusText}>Loading chats...</Text>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={item => item.id}
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
      )}
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
}
});