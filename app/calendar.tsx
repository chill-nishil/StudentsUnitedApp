import { db } from "@/FirebaseConfig";
import { router } from "expo-router";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

type Event = {
  id: string;
  title: string;
  date: any;
  description: string;
};

export default function CalendarScreen() {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "events"),
      orderBy("date", "asc")
    );

    const unsub = onSnapshot(q, snapshot => {
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          date: data.date,
          description: data.description
        };
      });
      setEvents(list);
    });

    return unsub;
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>January 2026</Text>

      <Pressable
        style={styles.addButton}
        onPress={() => router.push("/add-event")}>
            <Text>Add Event</Text>
    </Pressable>

      <FlatList
        data={events}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.eventCard}>
            <Text style={styles.eventTitle}>{item.title}</Text>
            <Text style={styles.eventDate}>
              {item.date?.toDate().toLocaleDateString()}
            </Text>
            <Text style={styles.eventDescription}>
              {item.description}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#dbeafe"
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16
  },
  eventCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "600"
  },
  eventDate: {
    marginTop: 4,
    color: "#2563EB"
  },
  eventDescription: {
    marginTop: 6,
    color: "#374151"
  },
  addButton: {
  backgroundColor: "#2563EB",
  padding: 12,
  borderRadius: 10,
  alignSelf: "flex-end",
  marginBottom: 12
},
addButtonText: {
  color: "white",
  fontWeight: "600"
}
});
