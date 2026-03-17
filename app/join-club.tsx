import { db } from "@/FirebaseConfig";
import { router } from "expo-router";
import { getAuth } from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  updateDoc
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

const POSITION_OPTIONS = [
  "New Member",
  "Recurring Member",
  "Board Member",
  "Other Position"
] as const;

export default function JoinClubScreen() {
  const auth = getAuth();
  const currentUid = auth.currentUser?.uid;

  const [searchText, setSearchText] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [otherPosition, setOtherPosition] = useState("");
  const [allClubs, setAllClubs] = useState<any[]>([]);
  const [clubResults, setClubResults] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [joinedClubIds, setJoinedClubIds] = useState<string[]>([]);
  const [pendingClubRequests, setPendingClubRequests] = useState<string[]>([]);
  const [positionOpenClubId, setPositionOpenClubId] = useState<string | null>(null);

  const hasAutoNavigatedRef = useRef(false);
  const previousClubCount = useRef(0);

  useEffect(() => {
  if (!currentUid) return;

  const userRef = doc(db, "users", currentUid);

  const unsub = onSnapshot(userRef, snap => {
    if (!snap.exists()) return;

    const data = snap.data();

    const nextJoinedClubIds = Array.isArray(data.clubIds) ? data.clubIds : [];
    const nextPendingClubRequests = Array.isArray(data.pendingClubRequests)
      ? data.pendingClubRequests
      : [];

    setJoinedClubIds(nextJoinedClubIds);
    setPendingClubRequests(nextPendingClubRequests);

    if (
      nextJoinedClubIds.length > previousClubCount.current &&
      previousClubCount.current !== 0 &&
      !hasAutoNavigatedRef.current
    ) {
      hasAutoNavigatedRef.current = true;
      router.dismissTo("/chat-dashboard");
    }

    previousClubCount.current = nextJoinedClubIds.length;
  });

  return unsub;
}, [currentUid]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "clubs"), snap => {
      const clubs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setAllClubs(clubs);
    });

    return unsub;
  }, []);

  useEffect(() => {
    const search = searchText.trim().toUpperCase();

    setError("");
    setSelectedPosition("");
    setOtherPosition("");
    setPositionOpenClubId(null);

    if (!search) {
      setClubResults([]);
      return;
    }

    const words = search.split(/\s+/).filter(Boolean);

    const results = allClubs.filter(club => {
      const clubName =
        typeof club.name === "string" ? club.name.toUpperCase() : "";

      return words.every(word => clubName.includes(word));
    });

    setClubResults(results);

    if (results.length === 0) {
      setError("No club found");
    }
  }, [searchText, allClubs]);

  async function sendJoinRequest(clubResult: any) {
    if (!clubResult || !currentUid) return;

    const cleanOtherPosition = otherPosition.trim();

    let finalPosition = selectedPosition;

    if (!selectedPosition) {
      setError("Choose a position for this club");
      return;
    }

    if (selectedPosition === "Other Position") {
      if (!cleanOtherPosition) {
        setError("Enter your position for this club");
        return;
      }
      finalPosition = cleanOtherPosition;
    }

    if (joinedClubIds.includes(clubResult.id)) {
      setError("You are already in this club");
      return;
    }

    if (pendingClubRequests.includes(clubResult.id)) {
      setError("You already sent a request to this club");
      return;
    }

    const clubRef = doc(db, "clubs", clubResult.id);
    const userRef = doc(db, "users", currentUid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      setError("User profile not found");
      return;
    }

    const userData = userSnap.data();
    const requesterName =
      typeof userData.name === "string" ? userData.name.trim() : "";

    await updateDoc(clubRef, {
      joinRequests: arrayUnion({
        uid: currentUid,
        name: requesterName,
        position: finalPosition,
        requestedAt: new Date()
      })
    });

    await updateDoc(userRef, {
      pendingClubRequests: arrayUnion(clubResult.id)
    });

    setError("");
    setSelectedPosition("");
    setOtherPosition("");
    setPositionOpenClubId(null);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Join a Club</Text>

      <TextInput
        placeholder="Enter club name"
        placeholderTextColor="#4B5563"
        value={searchText}
        onChangeText={setSearchText}
        autoCapitalize="characters"
        style={styles.input}
      />

      <Text style={styles.searchHint}>Start typing to find clubs</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {clubResults.map(clubResult => {
        const currentClubAlreadyRequested = pendingClubRequests.includes(clubResult.id);
        const currentClubAlreadyJoined = joinedClubIds.includes(clubResult.id);
        const positionOpen = positionOpenClubId === clubResult.id;

        return (
          <View key={clubResult.id} style={styles.result}>
            <Text style={styles.clubName}>{clubResult.name}</Text>

            {currentClubAlreadyJoined ? (
              <Text style={styles.pendingText}>
                You are already in this club.
              </Text>
            ) : currentClubAlreadyRequested ? (
              <Text style={styles.pendingText}>
                Request sent. Waiting for approval.
              </Text>
            ) : (
              <>
                <Pressable
                  style={styles.positionHeader}
                  onPress={() => {
                    if (positionOpen) {
                      setPositionOpenClubId(null);
                    } else {
                      setPositionOpenClubId(clubResult.id);
                      setSelectedPosition("");
                      setOtherPosition("");
                    }
                  }}
                >
                  <Text style={styles.positionTitle}>
                    Choose your position {positionOpen ? "▲" : "▼"}
                  </Text>
                </Pressable>

                {positionOpen && (
                  <View style={styles.positionOptionsWrap}>
                    {POSITION_OPTIONS.map(option => {
                      const isSelected = selectedPosition === option;

                      return (
                        <Pressable
                          key={option}
                          style={[
                            styles.positionOption,
                            isSelected && styles.positionOptionSelected
                          ]}
                          onPress={() => {
                            setSelectedPosition(option);
                            if (option !== "Other Position") {
                              setOtherPosition("");
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.positionOptionText,
                              isSelected && styles.positionOptionTextSelected
                            ]}
                          >
                            {option}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {positionOpen && selectedPosition === "Other Position" && (
                  <TextInput
                    placeholder="Enter your position"
                    placeholderTextColor="#4B5563"
                    value={otherPosition}
                    onChangeText={setOtherPosition}
                    style={styles.input}
                  />
                )}

                <Pressable
                  style={styles.joinButton}
                  onPress={() => sendJoinRequest(clubResult)}
                >
                  <Text style={styles.joinText}>Send Join Request</Text>
                </Pressable>
              </>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white"
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 120
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
  searchHint: {
    textAlign: "center",
    color: "#6B7280",
    marginBottom: 12
  },
  error: {
    marginTop: 12,
    color: "red",
    textAlign: "center"
  },
  result: {
    marginTop: 16,
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
  positionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 10
  },
  positionOptionsWrap: {
    marginBottom: 12
  },
  positionOption: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: "white"
  },
  positionOptionSelected: {
    backgroundColor: "#7b97d4",
    borderColor: "#7b97d4"
  },
  positionOptionText: {
    color: "#111827",
    textAlign: "center",
    fontWeight: "500"
  },
  positionOptionTextSelected: {
    color: "white",
    fontWeight: "600"
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
  positionHeader: {
    marginBottom: 10
  }
});