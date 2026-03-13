import { db } from "@/FirebaseConfig";
import { router } from "expo-router";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Calendar } from "react-native-calendars";

type Event = {
  id: string;
  title: string;
  date: any;
  description: string;
  location?: any;
  locationAddress?: string;
};

export default function CalendarScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("date", "asc"));

    const unsub = onSnapshot(q, snapshot => {
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          date: data.date,
          description: data.description,
          location: data.location ?? "",
          locationAddress: data.locationAddress ?? ""
        };
      });
      setEvents(list);
    });

    return unsub;
  }, []);

  const getSafeLocationText = (location: any) => {
    if (!location) return "";

    if (typeof location === "string") {
      return location.trim();
    }

    return "";
  };

  const getSafeAddressText = (address: any) => {
    if (!address) return "";

    if (typeof address === "string") {
      return address.trim();
    }

    return "";
  };

  const openInMaps = async (item: Event) => {
    try {
      const safeAddress = getSafeAddressText(item.locationAddress);

      if (!safeAddress) {
        Alert.alert("No address", "This event does not have an address yet.");
        return;
      }

      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        safeAddress
      )}`;

      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert("Error", "Could not open maps for this address.");
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open maps for this address.");
    }
  };

  const markedDates: any = {};

  events.forEach(event => {
    const dateStr = event.date?.toDate().toISOString().split("T")[0];

    if (!dateStr) return;

    markedDates[dateStr] = {
      marked: true,
      dotColor: "#2563EB"
    };
  });

  const filteredEvents = selectedDate
    ? events.filter(event => {
        const dateStr = event.date?.toDate().toISOString().split("T")[0];
        return dateStr === selectedDate;
      })
    : events;

  if (selectedDate) {
    markedDates[selectedDate] = {
      ...(markedDates[selectedDate] || {}),
      selected: true,
      selectedColor: "#2563EB"
    };
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>January 2026</Text>

      <Calendar
        markedDates={markedDates}
        onDayPress={day => {
          setSelectedDate(prev =>
            prev === day.dateString ? "" : day.dateString
          );
        }}
      />

      <View style={styles.listHeader}>
        <Text style={styles.subHeader}>
          {selectedDate ? "Events on " + selectedDate : "All Events"}
        </Text>

        <Pressable
          style={styles.addButton}
          onPress={() => router.push("/add-event")}
        >
          <Text style={styles.addButtonText}>Add Event</Text>
        </Pressable>
      </View>

      <FlatList
        data={filteredEvents}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const safeLocation = getSafeLocationText(item.location);

          return (
            <View style={styles.eventCard}>
              <Text style={styles.eventTitle}>{item.title}</Text>

              <Text style={styles.eventDate}>
                {item.date?.toDate().toLocaleDateString()}
              </Text>

              {!!safeLocation && (
                <Pressable onPress={() => openInMaps(item)}>
                  <Text style={styles.eventLocation}>{safeLocation}</Text>
                </Pressable>
              )}

              <Text style={styles.eventDescription}>{item.description}</Text>
            </View>
          );
        }}
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
  eventLocation: {
    marginTop: 4,
    color: "#1D4ED8",
    textDecorationLine: "underline"
  },
  eventDescription: {
    marginTop: 6,
    color: "#374151"
  },
  addButton: {
    backgroundColor: "#7b97d4",
    padding: 12,
    borderRadius: 10,
    alignSelf: "flex-end",
    marginTop: 12,
    marginBottom: 12
  },
  addButtonText: {
    color: "white",
    fontWeight: "600"
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 12
  },
  subHeader: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827"
  }
});