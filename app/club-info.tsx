import { db } from "@/FirebaseConfig";
import { useLocalSearchParams } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

export default function ClubInfoScreen() {
  const params = useLocalSearchParams<{ clubId?: string }>();
  const clubId = typeof params.clubId === "string" ? params.clubId : null;

  const [club, setClub] = useState<any>(null);

  useEffect(() => {
    if (!clubId) return;

    const clubRef = doc(db, "clubs", clubId);

    const unsub = onSnapshot(clubRef, snap => {
      if (!snap.exists()) return;
      setClub(snap.data());
    });

    return unsub;
  }, [clubId]);

  if (!club) {
    return (
      <View style={styles.loadingWrap}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Image */}
      {!!club.imageBase64 && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${club.imageBase64}` }}
          style={styles.image}
        />
      )}

      {/* Name */}
      <Text style={styles.clubName}>{club.name}</Text>

      {/* Code */}
      {!!club.clubCode && (
        <Text style={styles.clubCode}>Code: {club.clubCode}</Text>
      )}

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.sectionText}>
          {club.about || "No description yet."}
        </Text>
      </View>

      {/* Rules */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rules</Text>
        <Text style={styles.sectionText}>
          {club.rules || "No rules added."}
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Club Stats</Text>
        <Text style={styles.sectionText}>
          Members: {club.members?.length || 0}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white"
  },
  content: {
    padding: 20,
    paddingBottom: 80
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  image: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 16
  },
  clubName: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6
  },
  clubCode: {
    textAlign: "center",
    color: "#6B7280",
    marginBottom: 16
  },
  section: {
    marginTop: 14,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#F3F4F6"
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6
  },
  sectionText: {
    fontSize: 14,
    color: "#111827"
  }
});