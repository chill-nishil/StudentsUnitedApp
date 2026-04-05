import { db } from "@/FirebaseConfig";
import BottomNav from "@/components/BottomNav";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    updateDoc
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    FlatList,
    Linking,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View
} from "react-native";
import { Calendar } from "react-native-calendars";

type Attendee = {
  uid: string;
  name: string;
  position: string;
};

type Event = {
  id: string;
  clubId?: string;
  title: string;
  date: any;
  description: string;
  location?: any;
  locationAddress?: string;
  eventType?: "all-day" | "time";
  startDate?: any;
  endDate?: any;
  attendees?: Attendee[];
};

export default function GeneralCalendarScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const [currentUid, setCurrentUid] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentUserPosition, setCurrentUserPosition] = useState("");
  const [userClubIds, setUserClubIds] = useState<string[]>([]);
  const [clubNamesById, setClubNamesById] = useState<Record<string, string>>({});

  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [attendanceEvent, setAttendanceEvent] = useState<Event | null>(null);

  useEffect(() => {
    const auth = getAuth();

    const unsubAuth = onAuthStateChanged(auth, async user => {
      if (!user) {
        setCurrentUid("");
        setCurrentUserName("");
        setCurrentUserPosition("");
        setUserClubIds([]);
        setClubNamesById({});
        setEvents([]);
        return;
      }

      setCurrentUid(user.uid);

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

      setCurrentUserName(userData.name ?? "");
      setCurrentUserPosition(userData.position ?? "");
      setUserClubIds(clubIds);
    });

    return () => {
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (userClubIds.length === 0) {
      setClubNamesById({});
      return;
    }

    const unsubClubs = onSnapshot(collection(db, "clubs"), snapshot => {
      const nextMap: Record<string, string> = {};

      snapshot.docs.forEach(docItem => {
        if (userClubIds.includes(docItem.id)) {
          const data = docItem.data();
          nextMap[docItem.id] = data.name ?? "Unknown Club";
        }
      });

      setClubNamesById(nextMap);
    });

    return () => {
      unsubClubs();
    };
  }, [userClubIds]);

  useEffect(() => {
    if (userClubIds.length === 0) {
      setEvents([]);
      return;
    }

    const q = query(collection(db, "events"), orderBy("date", "asc"));

    const unsubEvents = onSnapshot(q, snapshot => {
      const list: Event[] = snapshot.docs
        .map(docItem => {
          const data = docItem.data();

          return {
            id: docItem.id,
            clubId: data.clubId ?? "",
            title: data.title ?? "",
            date: data.date ?? null,
            description: data.description ?? "",
            location: data.location ?? "",
            locationAddress: data.locationAddress ?? "",
            eventType: data.eventType ?? "all-day",
            startDate: data.startDate ?? null,
            endDate: data.endDate ?? null,
            attendees: Array.isArray(data.attendees) ? data.attendees : []
          };
        })
        .filter(event => !!event.clubId && userClubIds.includes(event.clubId));

      setEvents(list);

      if (attendanceEvent) {
        const updatedEvent = list.find(event => event.id === attendanceEvent.id);
        if (updatedEvent) {
          setAttendanceEvent(updatedEvent);
        }
      }
    });

    return () => {
      unsubEvents();
    };
  }, [userClubIds, attendanceEvent]);

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

  const isAttendingEvent = (item: Event) => {
    return !!item.attendees?.some(attendee => attendee.uid === currentUid);
  };

  const getCurrentAttendeeObject = (): Attendee => {
    return {
      uid: currentUid,
      name: currentUserName || "Unknown User",
      position: currentUserPosition || "Member"
    };
  };

  const toggleAttendance = async (item: Event) => {
    if (!currentUid) return;

    try {
      const eventRef = doc(db, "events", item.id);
      const attendeeObject = getCurrentAttendeeObject();
      const alreadyAttending = isAttendingEvent(item);

      if (alreadyAttending) {
        await updateDoc(eventRef, {
          attendees: arrayRemove(attendeeObject)
        });
      } else {
        await updateDoc(eventRef, {
          attendees: arrayUnion(attendeeObject)
        });
      }
    } catch {
      Alert.alert("Error", "Could not update attendance.");
    }
  };

  const openAttendanceList = (item: Event) => {
    setAttendanceEvent(item);
    setAttendanceModalVisible(true);
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
          {selectedDate ? "Events on " + selectedDate : "All Club Events"}
        </Text>
      </View>

      <FlatList
        data={filteredEvents}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) => {
          const safeLocation = getSafeLocationText(item.location);
          const attendeeCount = item.attendees?.length ?? 0;
          const attending = isAttendingEvent(item);
          const clubName = item.clubId ? clubNamesById[item.clubId] || "Club" : "Club";

          return (
            <View style={styles.eventCard}>
              <Text style={styles.clubLabel}>{clubName}</Text>

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

              <View style={styles.attendanceRow}>
                <Pressable
                  style={styles.checkboxRow}
                  onPress={() => toggleAttendance(item)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      attending && styles.checkboxChecked
                    ]}
                  >
                    {attending && <Text style={styles.checkmark}>✓</Text>}
                  </View>

                  <Text style={styles.checkboxLabel}>
                    {attending ? "You are attending" : "Sign Up"}
                  </Text>
                </Pressable>

                <Text style={styles.attendeeCount}>
                  {attendeeCount} attending
                </Text>
              </View>

              <Pressable onPress={() => openAttendanceList(item)}>
                <Text style={styles.attendanceLink}>View attendance list</Text>
              </Pressable>
            </View>
          );
        }}
      />

      <Modal
        visible={attendanceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAttendanceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {attendanceEvent?.title || "Attendance List"}
            </Text>

            {!attendanceEvent?.attendees?.length ? (
              <Text style={styles.emptyAttendanceText}>
                No one has signed up yet.
              </Text>
            ) : (
              <FlatList
                data={attendanceEvent.attendees}
                keyExtractor={item => item.uid}
                renderItem={({ item }) => (
                  <View style={styles.attendeeRow}>
                    <Text style={styles.attendeeName}>{item.name}</Text>
                    <Text style={styles.attendeePosition}>{item.position}</Text>
                  </View>
                )}
              />
            )}

            <Pressable
              style={styles.closeButton}
              onPress={() => setAttendanceModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  header: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16
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
  },
  eventCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12
  },
  clubLabel: {
    color: "#7b97d4",
    fontWeight: "700",
    marginBottom: 6
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
  attendanceRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white"
  },
  checkboxChecked: {
    backgroundColor: "#2563EB"
  },
  checkmark: {
    color: "white",
    fontWeight: "700"
  },
  checkboxLabel: {
    marginLeft: 8,
    color: "#111827",
    fontWeight: "500"
  },
  attendeeCount: {
    color: "#2563EB",
    fontWeight: "600"
  },
  attendanceLink: {
    marginTop: 8,
    color: "#1D4ED8",
    textDecorationLine: "underline",
    fontWeight: "500"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    paddingHorizontal: 20
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 18,
    maxHeight: "70%"
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
    color: "#111827"
  },
  emptyAttendanceText: {
    textAlign: "center",
    color: "#6B7280",
    marginVertical: 20
  },
  attendeeRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB"
  },
  attendeeName: {
    fontWeight: "600",
    color: "#111827"
  },
  attendeePosition: {
    marginTop: 2,
    color: "#6B7280"
  },
  closeButton: {
    marginTop: 14,
    backgroundColor: "#7b97d4",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center"
  },
  closeButtonText: {
    color: "white",
    fontWeight: "600"
  }
});