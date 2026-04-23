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
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Club = {
  id: string;
  name: string;
  groupIconBase64?: string | null;
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
        name: d.data().name || "Club",
        groupIconBase64: d.data().groupIconBase64 || null
      }));

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
        .filter(event => clubIds.includes(event.clubId));

      setEvents(list);
    });

    return unsub;
  }, [clubIds]);

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return events
      .filter(e => e.date?.toDate)
      .filter(e => {
        const eventDate = e.date.toDate();
        const normalizedEventDate = new Date(eventDate);
        normalizedEventDate.setHours(0, 0, 0, 0);
        return normalizedEventDate.getTime() >= today.getTime();
      })
      .sort((a, b) => a.date.toDate() - b.date.toDate());
  }, [events]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#dbeafe" }} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.logoWrap}>
          <Image
            source={require("../assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.welcome}>Welcome {userName}!</Text>

        <Text style={styles.sectionTitle}>Upcoming Events</Text>

        {upcomingEvents.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming events</Text>
        ) : (
          <View style={styles.eventsScrollBox}>
            <ScrollView
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {upcomingEvents.map(event => {
                const clubName =
                  clubs.find(c => c.id === event.clubId)?.name || "Club";

                return (
                  <Pressable
                    key={event.id}
                    style={styles.eventCard}
                    onPress={() =>
                      router.push({
                        pathname: "/general-calendar",
                        params: {
                          clubId: event.clubId,
                          clubName: clubName
                        }
                      })
                    }
                  >
                    <Text style={styles.eventClub}>{clubName}</Text>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventDate}>
                      {event.date?.toDate?.().toLocaleDateString()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
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
              {item.groupIconBase64 ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${item.groupIconBase64}` }}
                  style={styles.clubIconImage}
                />
              ) : (
                <View style={styles.clubIconFallback}>
                  <Text style={styles.clubIconFallbackText}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <Text style={styles.clubName}>{item.name}</Text>
            </Pressable>
          )}
        />
        <BottomNav />
      </View>
    </SafeAreaView>
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

  eventsScrollBox: {
    maxHeight: 240,
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 110
  },

  clubIconImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 8
  },

  clubIconFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#7b97d4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },

  clubIconFallbackText: {
    color: "white",
    fontSize: 20,
    fontWeight: "700"
  },

  clubName: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center"
  },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16
  }
});