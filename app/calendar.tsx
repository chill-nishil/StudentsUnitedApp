import { db } from "@/FirebaseConfig";
import { router, useLocalSearchParams } from "expo-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
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
  eventType?: "all-day" | "time";
  startDate?: any;
  endDate?: any;
};

export default function CalendarScreen() {
  const params = useLocalSearchParams();
  const selectedClubId =
    typeof params.clubId === "string" ? params.clubId : "";

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  useEffect(() => {
    const auth = getAuth();
    let unsubEvents: (() => void) | null = null;
    let deniedAlertShown = false;

    const unsubAuth = onAuthStateChanged(auth, async user => {
      if (unsubEvents) {
        unsubEvents();
        unsubEvents = null;
      }

      if (!user) {
        setEvents([]);
        return;
      }

      if (!selectedClubId) {
        setEvents([]);
        Alert.alert("Missing club", "No club was selected for this calendar.");
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setEvents([]);
        return;
      }

      const userData = userSnap.data();
      const clubIds: string[] = Array.isArray(userData.clubIds)
        ? userData.clubIds
        : [];

      if (!clubIds.includes(selectedClubId)) {
        setEvents([]);

        if (!deniedAlertShown) {
          deniedAlertShown = true;
          Alert.alert("Access denied", "You are not a member of this club.");
        }

        return;
      }

      const q = query(
        collection(db, "events"),
        where("clubId", "==", selectedClubId),
        orderBy("date", "asc")
      );

      unsubEvents = onSnapshot(q, snapshot => {
        const list: Event[] = snapshot.docs.map(docItem => {
          const data = docItem.data();

          return {
            id: docItem.id,
            title: data.title ?? "",
            date: data.date ?? null,
            description: data.description ?? "",
            location: data.location ?? "",
            locationAddress: data.locationAddress ?? "",
            eventType: data.eventType ?? "all-day",
            startDate: data.startDate ?? null,
            endDate: data.endDate ?? null
          };
        });

        setEvents(list);
      });
    });

    return () => {
      unsubAuth();

      if (unsubEvents) {
        unsubEvents();
      }
    };
  }, [selectedClubId]);

  const monthTitle = useMemo(() => {
    return calendarMonth.toLocaleDateString([], {
      month: "long",
      year: "numeric"
    });
  }, [calendarMonth]);

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

  const getEventDateText = (dateValue: any) => {
    if (!dateValue?.toDate) return "";
    return dateValue.toDate().toLocaleDateString();
  };

  const getEventTimeRangeText = (item: Event) => {
    if (item.eventType === "all-day") {
      return "All-Day";
    }

    if (
      item.eventType === "time" &&
      item.startDate?.toDate &&
      item.endDate?.toDate
    ) {
      const startText = item.startDate.toDate().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      });

      const endText = item.endDate.toDate().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      });

      return `${startText} - ${endText}`;
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
    const dateStr = event.date?.toDate?.().toISOString().split("T")[0];

    if (!dateStr) return;

    markedDates[dateStr] = {
      marked: true,
      dotColor: "#2563EB"
    };
  });

  const filteredEvents = selectedDate
    ? events.filter(event => {
        const dateStr = event.date?.toDate?.().toISOString().split("T")[0];
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
      <Text style={styles.header}>{monthTitle}</Text>

      <Calendar
        markedDates={markedDates}
        onDayPress={day => {
          setSelectedDate(prev =>
            prev === day.dateString ? "" : day.dateString
          );
        }}
        onMonthChange={month => {
          setCalendarMonth(new Date(month.year, month.month - 1, 1));
        }}
      />

      <View style={styles.listHeader}>
        <Text style={styles.subHeader}>
          {selectedDate ? "Events on " + selectedDate : "All Events"}
        </Text>

        <Pressable
          style={styles.addButton}
          onPress={() =>
            router.push({
              pathname: "/add-event",
              params: {
                clubId: selectedClubId
              }
            })
          }
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

              <View style={styles.dateRow}>
                <Text style={styles.eventDate}>
                  {getEventDateText(item.date)}
                </Text>

                <Text style={styles.eventTime}>
                  {getEventTimeRangeText(item)}
                </Text>
              </View>

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
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4
  },
  eventDate: {
    color: "#2563EB"
  },
  eventTime: {
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