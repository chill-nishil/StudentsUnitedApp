import { db } from "@/FirebaseConfig";
import { router, useLocalSearchParams } from "expo-router";
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where
} from "firebase/firestore";
import { useEffect, useState } from "react";
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
};

export default function ChatScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [userName, setUserName] = useState("");
  const [position, setPosition] = useState("");
  const [clubName, setClubName] = useState("");

  useEffect(() => {
    if (!uid) return;

    async function loadUser() {
      const q = query(
        collection(db, "users"),
        where("uid", "==", uid)
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        const data = snap.docs[0].data();
        setUserName(data.name);
        setPosition(data.position);
        setClubName(data.clubName || "Club Chat");
      }
    }

    loadUser();
  }, [uid]);

  useEffect(() => {
    const q = query(
      collection(db, "chats"),
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
          createdAt: data.createdAt
        };
      });
      setMessages(list);
    });

    return unsub;
  }, []);

  async function sendMessage() {
    if (!input.trim() || !userName) return;

    await addDoc(collection(db, "chats"), {
      message: input,
      senderName: userName,
      position: position,
      createdAt: serverTimestamp()
    });

    setInput("");
  }

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
            renderItem={({ item }) => (
              <View style={styles.message}>
                <Text style={styles.sender}>
                  {item.senderName} · {item.position}
                </Text>
                <Text>{item.message}</Text>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 16 }}
          />

          <View style={styles.row}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type message"
              style={styles.input}
            />
            <Pressable style={styles.send} onPress={sendMessage}>
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>
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
    backgroundColor: "#222",
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
}
});
