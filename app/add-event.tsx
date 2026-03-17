import { db } from "@/FirebaseConfig";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { getAuth } from "firebase/auth";
import { addDoc, collection, doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

export default function AddEventScreen() {
  const params = useLocalSearchParams();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [location, setLocation] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);

  const [eventType, setEventType] = useState<"all-day" | "time">("all-day");

  const [eventDate, setEventDate] = useState(new Date());

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d;
  });

  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setSeconds(0);
    d.setMilliseconds(0);
    d.setHours(d.getHours() + 1);
    return d;
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof params.locationName === "string") {
      setLocation(params.locationName);
    }

    if (typeof params.locationAddress === "string") {
      setLocationAddress(params.locationAddress);
    }

    if (typeof params.lat === "string") {
      const parsedLat = Number(params.lat);
      if (!Number.isNaN(parsedLat)) {
        setLocationLat(parsedLat);
      }
    }

    if (typeof params.lng === "string") {
      const parsedLng = Number(params.lng);
      if (!Number.isNaN(parsedLng)) {
        setLocationLng(parsedLng);
      }
    }
  }, [params.locationName, params.locationAddress, params.lat, params.lng]);

  const getDateOnlyValue = (date: Date) => {
    const updated = new Date(date);
    updated.setHours(0, 0, 0, 0);
    return updated;
  };

  const applySelectedDayToTime = (baseTime: Date, selectedDay: Date) => {
    const updated = new Date(baseTime);
    updated.setFullYear(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate()
    );
    return updated;
  };

  const handleAddEvent = async () => {
    if (!title.trim() || !description.trim()) {
      alert("Please fill out title and description");
      return;
    }

    if (eventType === "time" && endDate <= startDate) {
      alert("End time must be after start time");
      return;
    }

    try {
      setSaving(true);

      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        alert("You must be signed in.");
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        alert("Could not find user data.");
        return;
      }

      const userData = userSnap.data();
      const clubIds: string[] = userData.clubIds || [];

      if (!clubIds.length) {
        alert("You are not in a club.");
        return;
      }

      const clubId = clubIds[0];

      await addDoc(collection(db, "events"), {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        locationAddress: locationAddress.trim(),
        locationCoords:
          locationLat !== null && locationLng !== null
            ? {
                latitude: locationLat,
                longitude: locationLng
              }
            : null,
        eventType,
        date: getDateOnlyValue(eventDate),
        startDate: eventType === "time" ? startDate : null,
        endDate: eventType === "time" ? endDate : null,
        clubId
      });

      router.back();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Add Event</Text>

      <TextInput
        placeholder="Event title"
        placeholderTextColor="#4B5563"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
      />

      <TextInput
        placeholder="Description"
        placeholderTextColor="#4B5563"
        value={description}
        onChangeText={setDescription}
        style={[styles.input, styles.multiline]}
        multiline
      />

      <TextInput
        placeholder="Location name shown on calendar"
        placeholderTextColor="#4B5563"
        value={location}
        onChangeText={setLocation}
        style={styles.input}
      />

      <Pressable
        style={styles.mapButton}
        onPress={() =>
          router.push({
            pathname: "/map-picker",
            params: {
              initialName: location,
              initialAddress: locationAddress,
              initialLat:
                locationLat !== null ? String(locationLat) : undefined,
              initialLng:
                locationLng !== null ? String(locationLng) : undefined
            }
          })
        }
      >
        <Text style={styles.mapButtonText}>
          {locationLat !== null && locationLng !== null
            ? "Change Location on Map"
            : "Pick Location on Map"}
        </Text>
      </Pressable>

      {!!locationAddress && (
        <View style={styles.addressBox}>
          <Text style={styles.addressLabel}>Selected address</Text>
          <Text style={styles.addressText}>{locationAddress}</Text>
        </View>
      )}

      <View style={styles.typeToggleWrap}>
        <Pressable
          style={[
            styles.typeToggleButton,
            eventType === "all-day" && styles.typeToggleButtonActive
          ]}
          onPress={() => {
            setEventType("all-day");
            setShowStartTimePicker(false);
            setShowEndTimePicker(false);
          }}
        >
          <Text
            style={[
              styles.typeToggleText,
              eventType === "all-day" && styles.typeToggleTextActive
            ]}
          >
            All-Day
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.typeToggleButton,
            eventType === "time" && styles.typeToggleButtonActive
          ]}
          onPress={() => setEventType("time")}
        >
          <Text
            style={[
              styles.typeToggleText,
              eventType === "time" && styles.typeToggleTextActive
            ]}
          >
            Time
          </Text>
        </Pressable>
      </View>

      <View style={styles.inlineContainer}>
        <Pressable
          style={[styles.inlineRow, styles.firstInlineRow]}
          onPress={() => {
            setShowDatePicker(prev => !prev);
          }}
        >
          <Text style={styles.inlineLabel}>Date</Text>
          <Text style={styles.inlineValue}>
            {eventDate.toLocaleDateString()}
          </Text>
        </Pressable>

        {showDatePicker && (
          <DateTimePicker
            value={eventDate}
            mode="date"
            display="inline"
            themeVariant="light"
            onChange={(event, selectedDate) => {
              if (!selectedDate) return;

              const updatedEventDate = new Date(eventDate);
              updatedEventDate.setFullYear(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                selectedDate.getDate()
              );
              setEventDate(updatedEventDate);

              setStartDate(prev => applySelectedDayToTime(prev, selectedDate));
              setEndDate(prev => applySelectedDayToTime(prev, selectedDate));
            }}
          />
        )}

        {eventType === "time" && (
          <>
            <Pressable
              style={styles.inlineRow}
              onPress={() => {
                setShowStartTimePicker(prev => !prev);
              }}
            >
              <Text style={styles.inlineLabel}>Start Time</Text>
              <Text style={styles.inlineValue}>
                {startDate.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit"
                })}
              </Text>
            </Pressable>

            {showStartTimePicker && (
              <DateTimePicker
                value={startDate}
                mode="time"
                display="inline"
                themeVariant="light"
                onChange={(event, selectedDate) => {
                  if (!selectedDate) return;

                  const updated = new Date(startDate);
                  updated.setHours(selectedDate.getHours());
                  updated.setMinutes(selectedDate.getMinutes());
                  updated.setSeconds(0);
                  updated.setMilliseconds(0);
                  setStartDate(updated);

                  if (endDate <= updated) {
                    const newEnd = new Date(updated);
                    newEnd.setHours(newEnd.getHours() + 1);
                    setEndDate(newEnd);
                  }
                }}
              />
            )}

            <Pressable
              style={styles.inlineRow}
              onPress={() => {
                setShowEndTimePicker(prev => !prev);
              }}
            >
              <Text style={styles.inlineLabel}>End Time</Text>
              <Text style={styles.inlineValue}>
                {endDate.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit"
                })}
              </Text>
            </Pressable>

            {showEndTimePicker && (
              <DateTimePicker
                value={endDate}
                mode="time"
                display="inline"
                themeVariant="light"
                onChange={(event, selectedDate) => {
                  if (!selectedDate) return;

                  const updated = new Date(endDate);
                  updated.setHours(selectedDate.getHours());
                  updated.setMinutes(selectedDate.getMinutes());
                  updated.setSeconds(0);
                  updated.setMilliseconds(0);
                  setEndDate(updated);
                }}
              />
            )}
          </>
        )}
      </View>

      <Pressable
        style={[styles.button, saving && styles.disabled]}
        onPress={handleAddEvent}
        disabled={saving}
      >
        <Text style={styles.buttonText}>
          {saving ? "Saving..." : "Save Event"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#dbeafe"
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
    color: "#111827"
  },
  input: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB"
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: "top"
  },
  mapButton: {
    backgroundColor: "#7b97d4",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10
  },
  mapButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600"
  },
  addressBox: {
    backgroundColor: "white",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 12,
    marginBottom: 12
  },
  addressLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4
  },
  addressText: {
    fontSize: 14,
    color: "#111827"
  },
  typeToggleWrap: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 4,
    marginBottom: 12
  },
  typeToggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center"
  },
  typeToggleButtonActive: {
    backgroundColor: "#2563EB"
  },
  typeToggleText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151"
  },
  typeToggleTextActive: {
    color: "white"
  },
  inlineContainer: {
    backgroundColor: "white",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    marginBottom: 12,
    overflow: "hidden"
  },
  inlineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    borderTopWidth: 1,
    borderColor: "#E5E7EB"
  },
  firstInlineRow: {
    borderTopWidth: 0
  },
  inlineLabel: {
    fontSize: 16,
    color: "#111",
    fontWeight: "500"
  },
  inlineValue: {
    fontSize: 16,
    color: "#2563EB"
  },
  button: {
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 10,
    marginTop: 8
  },
  disabled: {
    opacity: 0.6
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600"
  }
});