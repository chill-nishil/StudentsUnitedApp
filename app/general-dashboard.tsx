import BottomNav from "@/components/BottomNav";
import { db } from "@/FirebaseConfig";
import { router } from "expo-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

type Club = {
  id: string;
  name: string;
};

type Event = {
  id: string;
  clubId: string;
  title: string;
  date: any;
};

export default function GeneralDashboard() {
  const [currentUid, setCurrentUid] = useState("");
  const [userName, setUserName] = useState("");
  const [clubIds, setClubIds] = useState<string[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    const auth = getAuth();

    const unsub = onAuthStateChanged(auth, async user => {
      if (!user) return;

      setCurrentUid(user.uid);

      // Get user document from Firestore
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) return;

      const data = snap.data();
      setUserName(data.name || "");
      setClubIds(Array.isArray(data.clubIds) ? data.clubIds : []);
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
      const list: Club[] = snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || "Club"
      }));

      // Save clubs user belongs to
      setClubs(list);
    });

    return unsub;
  }, [currentUid]);

  useEffect(() => {
    if (clubIds.length === 0) return;

    const unsub = onSnapshot(collection(db, "events"), snap => {
      const list: Event[] = snap.docs
        .map(d => ({
          id: d.id,
          clubId: d.data().clubId,
          title: d.data().title,
          date: d.data().date
        }))
        // Only keep events from user's clubs
        .filter(event => clubIds.includes(event.clubId));

      setEvents(list);
    });

    return unsub;
  }, [clubIds]);

  // display 3 upcoming events
  const upcomingEvents = useMemo(() => {
    return events
      .filter(e => e.date?.toDate)
      .sort((a, b) => a.date.toDate() - b.date.toDate())
      .slice(0, 3);
  }, [events]);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Image
          source={require("../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.welcome}>Welcome, {userName}</Text>

      <Text style={styles.sectionTitle}>Upcoming Events</Text>

      {upcomingEvents.length === 0 ? (
        <Text style={styles.emptyText}>No upcoming events</Text>
      ) : (
        upcomingEvents.map(event => {
          const clubName =
            clubs.find(c => c.id === event.clubId)?.name || "Club";

          return (
            <View key={event.id} style={styles.eventCard}>
              <Text style={styles.eventClub}>{clubName}</Text>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventDate}>
                {event.date?.toDate?.().toLocaleDateString()}
              </Text>
            </View>
          );
        })
      )}


      <Text style={styles.sectionTitle}>My Chat Rooms</Text>

      <FlatList
        data={clubs}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={styles.clubCard}
            onPress={() =>
              router.push({
                pathname: "/chat-room",
                params: {
                  clubId: item.id,
                  clubName: item.name
                }
              })
            }
          >
            <Text style={styles.clubName}>{item.name}</Text>
          </Pressable>
        )}
      />
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#dbeafe",
    padding: 18,
    paddingBottom: 95
  },

  logoWrap: {
    alignItems: "center",
    marginBottom: 16
  },

  logo: {
    width: 253,
    height: 138
  },

  welcome: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 20,
    marginTop: 10
  },

  emptyText: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 8
  },

  eventCard: {
    backgroundColor: "white",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8
  },

  eventClub: {
    fontSize: 11,
    color: "#7b97d4",
    fontWeight: "600"
  },

  eventTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 1
  },

  eventDate: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 1
  },

  clubCard: {
    backgroundColor: "white",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginRight: 8,
    justifyContent: "center"
  },

  clubName: {
    fontSize: 11,
    fontWeight: "600"
  },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16
  }
});