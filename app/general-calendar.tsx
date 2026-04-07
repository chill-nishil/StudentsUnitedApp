import { db } from "@/FirebaseConfig";
import BottomNav from "@/components/BottomNav";
import * as ExpoCalendar from "expo-calendar";
import { router } from "expo-router";
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
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { Calendar } from "react-native-calendars";

type Attendee = {
  uid: string;
  name: string;
  position: string;
};

type ClubEvent = {
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

type PhoneCalendarEvent = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  notes?: string;
  location?: string;
  allDay?: boolean;
};

type CombinedListItem =
  | {
      source: "club";
      sortDate: Date | null;
      data: ClubEvent;
    }
  | {
      source: "phone";
      sortDate: Date | null;
      data: PhoneCalendarEvent;
    };

export default function GeneralCalendarScreen() {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [phoneCalendarEvents, setPhoneCalendarEvents] = useState<PhoneCalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(new Date());

  const [currentUid, setCurrentUid] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentUserPosition, setCurrentUserPosition] = useState("");
  const [userClubIds, setUserClubIds] = useState<string[]>([]);
  const [clubNamesById, setClubNamesById] = useState<Record<string, string>>({});
  const [clubMemberships, setClubMemberships] = useState<any[]>([]);

  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [attendanceEvent, setAttendanceEvent] = useState<ClubEvent | null>(null);

  const [selectedClubFilter, setSelectedClubFilter] = useState("all");
  const [clubDropdownOpen, setClubDropdownOpen] = useState(false);

  const [showPhoneCalendarEvents, setShowPhoneCalendarEvents] = useState(false);
  const [calendarPermissionGranted, setCalendarPermissionGranted] = useState(false);
  const [isLoadingPhoneEvents, setIsLoadingPhoneEvents] = useState(false);

  useEffect(() => {
    const auth = getAuth();

    const unsubAuth = onAuthStateChanged(auth, async user => {
      if (!user) {
        setCurrentUid("");
        setCurrentUserName("");
        setCurrentUserPosition("");
        setUserClubIds([]);
        setClubNamesById({});
        setClubMemberships([]);
        setEvents([]);
        setPhoneCalendarEvents([]);
        setSelectedClubFilter("all");
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
      setClubMemberships(
        Array.isArray(userData.clubMemberships) ? userData.clubMemberships : []
      );
      setSelectedClubFilter("all");
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
      const list: ClubEvent[] = snapshot.docs
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

  useEffect(() => {
    if (!showPhoneCalendarEvents || !calendarPermissionGranted) return;

    loadPhoneCalendarEventsForMonth(visibleMonth);
  }, [showPhoneCalendarEvents, calendarPermissionGranted, visibleMonth]);

  const userClubOptions = useMemo(() => {
    return userClubIds.map(clubId => ({
      id: clubId,
      name: clubNamesById[clubId] || "Unknown Club"
    }));
  }, [userClubIds, clubNamesById]);

  const selectedClubName =
    selectedClubFilter === "all"
      ? "All Clubs"
      : clubNamesById[selectedClubFilter] || "Club";

  const canAddEventsForSelectedClub = useMemo(() => {
    if (selectedClubFilter === "all") return false;

    const membership = clubMemberships.find(
      membershipItem => membershipItem?.clubId === selectedClubFilter
    );

    const role = String(membership?.position || "").trim().toLowerCase();

    return role === "president" || role === "board member";
  }, [clubMemberships, selectedClubFilter]);

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

  const getFirestoreDate = (value: any): Date | null => {
    if (!value) return null;

    if (typeof value?.toDate === "function") {
      const d = value.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    }

    if (value instanceof Date) {
      return !isNaN(value.getTime()) ? value : null;
    }

    return null;
  };

  const getClubEventBaseDate = (item: ClubEvent): Date | null => {
    return getFirestoreDate(item.date);
  };

  const getClubEventSortDate = (item: ClubEvent): Date | null => {
    if (item.eventType === "time") {
      return getFirestoreDate(item.startDate) || getFirestoreDate(item.date);
    }

    return getFirestoreDate(item.date);
  };

  const getClubEventDateText = (dateValue: any) => {
    const safeDate = getFirestoreDate(dateValue);
    if (!safeDate) return "";
    return safeDate.toLocaleDateString();
  };

  const getClubEventTimeRangeText = (item: ClubEvent) => {
    if (item.eventType === "all-day") {
      return "All-Day";
    }

    const startDate = getFirestoreDate(item.startDate);
    const endDate = getFirestoreDate(item.endDate);

    if (item.eventType === "time" && startDate && endDate) {
      const startText = startDate.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      });

      const endText = endDate.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      });

      return `${startText} - ${endText}`;
    }

    return "";
  };

  const getPhoneEventDateText = (item: PhoneCalendarEvent) => {
    return item.startDate.toLocaleDateString();
  };

  const getPhoneEventTimeRangeText = (item: PhoneCalendarEvent) => {
    if (item.allDay) {
      return "All-Day";
    }

    const startText = item.startDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });

    const endText = item.endDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });

    return `${startText} - ${endText}`;
  };

  const openInMaps = async (safeAddress: string) => {
    try {
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

  const isAttendingEvent = (item: ClubEvent) => {
    return !!item.attendees?.some(attendee => attendee.uid === currentUid);
  };

  const getCurrentAttendeeObject = (): Attendee => {
    return {
      uid: currentUid,
      name: currentUserName || "Unknown User",
      position: currentUserPosition || "Member"
    };
  };

  const toggleAttendance = async (item: ClubEvent) => {
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

  const openAttendanceList = (item: ClubEvent) => {
    setAttendanceEvent(item);
    setAttendanceModalVisible(true);
  };

  const requestCalendarAccess = async () => {
    try {
      const currentPermissions = await ExpoCalendar.getCalendarPermissionsAsync();

      if (currentPermissions.granted) {
        setCalendarPermissionGranted(true);
        return true;
      }

      const requestedPermissions = await ExpoCalendar.requestCalendarPermissionsAsync();

      if (requestedPermissions.granted) {
        setCalendarPermissionGranted(true);
        return true;
      }

      setCalendarPermissionGranted(false);
      return false;
    } catch {
      setCalendarPermissionGranted(false);
      return false;
    }
  };

  const loadPhoneCalendarEventsForMonth = async (monthDate: Date) => {
    try {
      setIsLoadingPhoneEvents(true);

      const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0);
      const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const calendars = await ExpoCalendar.getCalendarsAsync(ExpoCalendar.EntityTypes.EVENT);
      const calendarIds = calendars.map(calendarItem => calendarItem.id);

      if (calendarIds.length === 0) {
        setPhoneCalendarEvents([]);
        return;
      }

      const nativeEvents = await ExpoCalendar.getEventsAsync(calendarIds, startOfMonth, endOfMonth);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const cleanedEvents: PhoneCalendarEvent[] = nativeEvents
        .map(nativeEvent => {
          const startDate = nativeEvent.startDate instanceof Date
            ? nativeEvent.startDate
            : new Date(nativeEvent.startDate);

          const endDate = nativeEvent.endDate instanceof Date
            ? nativeEvent.endDate
            : new Date(nativeEvent.endDate);

          return {
            id: nativeEvent.id,
            title: nativeEvent.title || "Untitled Event",
            startDate,
            endDate,
            notes: nativeEvent.notes || "",
            location: nativeEvent.location || "",
            allDay: !!nativeEvent.allDay
          };
        })
        .filter(item => {
          if (!(item.startDate instanceof Date) || isNaN(item.startDate.getTime())) {
            return false;
          }

          const normalizedStart = new Date(item.startDate);
          normalizedStart.setHours(0, 0, 0, 0);

          return normalizedStart.getTime() >= today.getTime();
        })
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

      setPhoneCalendarEvents(cleanedEvents);
    } catch {
      Alert.alert("Calendar Error", "Could not load phone calendar events.");
      setPhoneCalendarEvents([]);
    } finally {
      setIsLoadingPhoneEvents(false);
    }
  };

  const handlePhoneCalendarToggle = async (value: boolean) => {
    if (!value) {
      setShowPhoneCalendarEvents(false);
      setPhoneCalendarEvents([]);
      return;
    }

    const granted = await requestCalendarAccess();

    if (!granted) {
      Alert.alert(
        "Permission Needed",
        "Allow calendar access to show your phone calendar events in this screen."
      );
      setShowPhoneCalendarEvents(false);
      return;
    }

    setShowPhoneCalendarEvents(true);
  };

  const clubFilteredEvents =
    selectedClubFilter === "all"
      ? events
      : events.filter(event => event.clubId === selectedClubFilter);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingClubFilteredEvents = clubFilteredEvents.filter(event => {
    const eventDate = getClubEventBaseDate(event);

    if (!eventDate) return false;

    const normalizedEventDate = new Date(eventDate);
    normalizedEventDate.setHours(0, 0, 0, 0);

    return normalizedEventDate.getTime() >= today.getTime();
  });

  const visiblePhoneEvents = showPhoneCalendarEvents
    ? phoneCalendarEvents
    : [];

  const markedDates: any = {};

  upcomingClubFilteredEvents.forEach(event => {
    const eventDate = getClubEventBaseDate(event);
    if (!eventDate) return;

    const dateStr = eventDate.toISOString().split("T")[0];

    if (!markedDates[dateStr]) {
      markedDates[dateStr] = { dots: [] as any[] };
    }

    markedDates[dateStr].dots.push({
      key: `club-${event.id}`,
      color: "#2563EB"
    });
  });

  visiblePhoneEvents.forEach(event => {
    const dateStr = event.startDate.toISOString().split("T")[0];

    if (!markedDates[dateStr]) {
      markedDates[dateStr] = { dots: [] as any[] };
    }

    markedDates[dateStr].dots.push({
      key: `phone-${event.id}`,
      color: "#6B7280"
    });
  });

  const filteredClubEvents = selectedDate
    ? upcomingClubFilteredEvents.filter(event => {
        const eventDate = getClubEventBaseDate(event);
        if (!eventDate) return false;

        const dateStr = eventDate.toISOString().split("T")[0];
        return dateStr === selectedDate;
      })
    : upcomingClubFilteredEvents;

  const filteredPhoneEvents = selectedDate
    ? visiblePhoneEvents.filter(event => {
        const dateStr = event.startDate.toISOString().split("T")[0];
        return dateStr === selectedDate;
      })
    : visiblePhoneEvents;

  const combinedListItems: CombinedListItem[] = [
    ...filteredClubEvents.map(event => ({
      source: "club" as const,
      sortDate: getClubEventSortDate(event),
      data: event
    })),
    ...filteredPhoneEvents.map(event => ({
      source: "phone" as const,
      sortDate: event.startDate,
      data: event
    }))
  ].sort((a, b) => {
    const aTime = a.sortDate ? a.sortDate.getTime() : 0;
    const bTime = b.sortDate ? b.sortDate.getTime() : 0;
    return aTime - bTime;
  });

  if (selectedDate) {
    markedDates[selectedDate] = {
      ...(markedDates[selectedDate] || {}),
      selected: true,
      selectedColor: "#2563EB",
      dots: markedDates[selectedDate]?.dots || []
    };
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>Calendar</Text>

        {/* <Text style={styles.monthLabel}>
          {visibleMonth.toLocaleDateString([], {
            month: "long",
            year: "numeric"
          })}
        </Text> */}

        <Calendar
          markingType="multi-dot"
          markedDates={markedDates}
          enableSwipeMonths={true}
          onDayPress={day => {
            setSelectedDate(prev =>
              prev === day.dateString ? "" : day.dateString
            );
          }}
          onMonthChange={month => {
            setVisibleMonth(new Date(month.year, month.month - 1, 1));
          }}
        />

        <View style={styles.listHeader}>
          <Text style={styles.subHeader}>
            {selectedDate
              ? `Events on ${selectedDate}`
              : selectedClubFilter === "all"
              ? "Upcoming Events"
              : `Upcoming ${selectedClubName} Events`}
          </Text>

          <View style={styles.rightHeaderControls}>
            <View style={styles.dropdownWrap}>
              <Pressable
                style={styles.dropdownButton}
                onPress={() => setClubDropdownOpen(prev => !prev)}
              >
                <Text style={styles.dropdownButtonText} numberOfLines={1}>
                  {selectedClubName}
                </Text>
                <Text style={styles.dropdownArrow}>
                  {clubDropdownOpen ? "▲" : "▼"}
                </Text>
              </Pressable>

              {clubDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  <Pressable
                    style={styles.dropdownOption}
                    onPress={() => {
                      setSelectedClubFilter("all");
                      setClubDropdownOpen(false);
                    }}
                  >
                    <Text style={styles.dropdownOptionText}>All Clubs</Text>
                  </Pressable>

                  {userClubOptions.map(club => (
                    <Pressable
                      key={club.id}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setSelectedClubFilter(club.id);
                        setClubDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{club.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {canAddEventsForSelectedClub && (
              <Pressable
                style={styles.addEventButton}
                onPress={() =>
                  router.push({
                    pathname: "/add-event",
                    params: {
                      clubId: selectedClubFilter,
                      clubName: selectedClubName
                    }
                  })
                }
              >
                <Text style={styles.addEventButtonText}>Add Event</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.syncRow}>
          <Text style={styles.syncLabel}>
            Show Phone Calendar Events
          </Text>

          <View style={styles.syncRightSide}>
            {isLoadingPhoneEvents ? (
              <Text style={styles.syncStatus}>Loading...</Text>
            ) : showPhoneCalendarEvents ? (
              <Text style={styles.syncStatus}>On</Text>
            ) : (
              <Text style={styles.syncStatus}>Off</Text>
            )}

            <Switch
              value={showPhoneCalendarEvents}
              onValueChange={handlePhoneCalendarToggle}
              trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
              thumbColor={showPhoneCalendarEvents ? "#2563EB" : "#F9FAFB"}
              ios_backgroundColor="#D1D5DB"
            />
          </View>
        </View>

        {combinedListItems.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              No upcoming events to show.
            </Text>
          </View>
        ) : (
          combinedListItems.map(item => {
            if (item.source === "club") {
              const clubEvent = item.data;
              const safeLocation = getSafeLocationText(clubEvent.location);
              const attendeeCount = clubEvent.attendees?.length ?? 0;
              const attending = isAttendingEvent(clubEvent);
              const clubName = clubEvent.clubId
                ? clubNamesById[clubEvent.clubId] || "Club"
                : "Club";

              return (
                <View key={`club-${clubEvent.id}`} style={styles.eventCard}>
                  <Text style={styles.clubLabel}>{clubName}</Text>

                  <Text style={styles.eventTitle}>{clubEvent.title}</Text>

                  <View style={styles.dateRow}>
                    <Text style={styles.eventDate}>
                      {getClubEventDateText(clubEvent.date)}
                    </Text>

                    <Text style={styles.eventTime}>
                      {getClubEventTimeRangeText(clubEvent)}
                    </Text>
                  </View>

                  {!!safeLocation && (
                    <Pressable
                      onPress={() =>
                        openInMaps(getSafeAddressText(clubEvent.locationAddress))
                      }
                    >
                      <Text style={styles.eventLocation}>{safeLocation}</Text>
                    </Pressable>
                  )}

                  <Text style={styles.eventDescription}>
                    {clubEvent.description}
                  </Text>

                  <View style={styles.attendanceRow}>
                    <Pressable
                      style={styles.checkboxRow}
                      onPress={() => toggleAttendance(clubEvent)}
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

                  <Pressable onPress={() => openAttendanceList(clubEvent)}>
                    <Text style={styles.attendanceLink}>
                      View attendance list
                    </Text>
                  </Pressable>
                </View>
              );
            }

            const phoneEvent = item.data;

            return (
              <View key={`phone-${phoneEvent.id}`} style={styles.phoneEventCard}>
                <Text style={styles.phoneLabel}>Phone Calendar</Text>

                <Text style={styles.eventTitle}>{phoneEvent.title}</Text>

                <View style={styles.dateRow}>
                  <Text style={styles.eventDate}>
                    {getPhoneEventDateText(phoneEvent)}
                  </Text>

                  <Text style={styles.eventTime}>
                    {getPhoneEventTimeRangeText(phoneEvent)}
                  </Text>
                </View>

                {!!phoneEvent.location && (
                  <Text style={styles.phoneLocation}>
                    {phoneEvent.location}
                  </Text>
                )}

                {!!phoneEvent.notes && (
                  <Text style={styles.eventDescription}>
                    {phoneEvent.notes}
                  </Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

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
              <ScrollView showsVerticalScrollIndicator={false}>
                {attendanceEvent.attendees.map(item => (
                  <View key={item.uid} style={styles.attendeeRow}>
                    <Text style={styles.attendeeName}>{item.name}</Text>
                    <Text style={styles.attendeePosition}>{item.position}</Text>
                  </View>
                ))}
              </ScrollView>
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#dbeafe"
  },
  contentContainer: {
    padding: 18,
    paddingBottom: 120
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10
  },
  monthLabel: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 8,
    zIndex: 1000
  },
  subHeader: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    paddingRight: 10,
    marginTop: 9
  },
  rightHeaderControls: {
    alignItems: "flex-end"
  },
  dropdownWrap: {
    width: 145,
    position: "relative"
  },
  dropdownButton: {
    minHeight: 42,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  dropdownButtonText: {
    flex: 1,
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
    marginRight: 8
  },
  dropdownArrow: {
    color: "#6B7280",
    fontSize: 11
  },
  dropdownMenu: {
    position: "absolute",
    top: 46,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    overflow: "hidden",
    elevation: 5,
    zIndex: 2000
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#EFF6FF"
  },
  dropdownOptionText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "500"
  },
  addEventButton: {
    marginTop: 8,
    backgroundColor: "#7b97d4",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10
  },
  addEventButtonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600"
  },
  syncRow: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  syncLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginRight: 10
  },
  syncRightSide: {
    flexDirection: "row",
    alignItems: "center"
  },
  syncStatus: {
    marginRight: 8,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600"
  },
  eventCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12
  },
  phoneEventCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1"
  },
  clubLabel: {
    color: "#7b97d4",
    fontWeight: "700",
    marginBottom: 6
  },
  phoneLabel: {
    color: "#6B7280",
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
  phoneLocation: {
    marginTop: 4,
    color: "#475569"
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
  emptyWrap: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 18,
    alignItems: "center"
  },
  emptyText: {
    color: "#6B7280",
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