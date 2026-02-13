import { db } from "@/FirebaseConfig";
import { getAuth } from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

export default function JoinClubScreen() {
  const auth = getAuth();
  const currentUid = auth.currentUser?.uid;

  const [searchText, setSearchText] = useState("");
  const [clubResult, setClubResult] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [requestSent, setRequestSent] = useState(false);

  async function searchClub() {
    setError("");
    setClubResult(null);

    if (!searchText.trim()) {
      setError("Enter a club name");
      return;
    }

    const q = query(
      collection(db, "clubs"),
      where("name", "==", searchText.trim())
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      setError("No club found");
      return;
    }

    setClubResult({
      id: snap.docs[0].id,
      ...snap.docs[0].data()
    });
  }

    async function sendJoinRequest() {
    if (!clubResult || !currentUid) return;

    const clubRef = doc(db, "clubs", clubResult.id);

    await updateDoc(clubRef, {
        joinRequests: arrayUnion(currentUid)
    });

    setRequestSent(true);
    }   


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join a Club</Text>

      <TextInput
        placeholder="Enter club name"
        value={searchText}
        onChangeText={setSearchText}
        style={styles.input}
      />
      <Pressable style={styles.searchButton} onPress={searchClub}>
            <Text style={styles.searchText}>Search</Text>
        </Pressable>


      {error ? <Text style={styles.error}>{error}</Text> : null}

        {clubResult && (
    <View style={styles.result}>
        <Text style={styles.clubName}>{clubResult.name}</Text>

        {requestSent ? (
        <Text style={styles.pendingText}>
            Request sent. Waiting for approval.
        </Text>
        ) : (
        <Pressable
            style={styles.joinButton}
            onPress={sendJoinRequest}
        >
            <Text style={styles.joinText}>Send Join Request</Text>
        </Pressable>
        )}
    </View>
    )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "white"
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center"
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12
  },
  button: {
    backgroundColor: "#7b97d4",
    padding: 12,
    borderRadius: 8
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600"
  },
  error: {
    marginTop: 12,
    color: "red",
    textAlign: "center"
  },
  result: {
    marginTop: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8
  },
  clubName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8
  },
  joinButton: {
    backgroundColor: "#222",
    padding: 10,
    borderRadius: 6
  },
  joinText: {
    color: "white",
    textAlign: "center"
  },
  pendingText: {
  marginTop: 12,
  textAlign: "center",
  color: "#6B7280",
  fontSize: 14 
  },
  searchButton: {
  backgroundColor: "#7b97d4",
  padding: 12,
  borderRadius: 8,
  marginBottom: 12
},
searchText: {
color: "white",
textAlign: "center",
fontWeight: "600"
}
});
