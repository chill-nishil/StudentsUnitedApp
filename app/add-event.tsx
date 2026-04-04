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
  // Gets route parameters passed from other screens, such as the map picker
  const params = useLocalSearchParams();

  // State for basic event information
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // State for location information
  const [location, setLocation] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);

  // Tracks whether the event is all day or has a start and end time
  const [eventType, setEventType] = useState<"all-day" | "time">("all-day");

  // Stores the selected day for the event
  const [eventDate, setEventDate] = useState(new Date());

  // Stores the start time for timed events
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d;
  });

  // Stores the end time for timed events, defaulting to 1 hour after start
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setSeconds(0);
    d.setMilliseconds(0);
    d.setHours(d.getHours() + 1);
    return d;
  });

  // Controls whether each date or time picker is visible
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Tracks whether the event is currently being saved
  const [saving, setSaving] = useState(false);

  // When the user returns from the map picker, update the location fields
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

  // Returns a date with the time cleared out, useful for storing only the event day
  const getDateOnlyValue = (date: Date) => {
    const updated = new Date(date);
    updated.setHours(0, 0, 0, 0);
    return updated;
  };

  // Copies the selected year, month, and day onto an existing time
  // This keeps the chosen time but moves it to the selected event date
  const applySelectedDayToTime = (baseTime: Date, selectedDay: Date) => {
    const updated = new Date(baseTime);
    updated.setFullYear(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate()
    );
    return updated;
  };

  // Handles validation and saving the event to Firestore
  const handleAddEvent = async () => {
    // Make sure required fields are filled out
    if (!title.trim() || !description.trim()) {
      alert("Please fill out title and description");
      return;
    }

    // For timed events, make sure the end time is later than the start time
    if (eventType === "time" && endDate <= startDate) {
      alert("End time must be after start time");
      return;
    }

    try {
      // Show saving state while uploading event data
      setSaving(true);

      // Get the currently signed in Firebase user
      const auth = getAuth();
      const user = auth.currentUser;

      // Stop if no user is signed in
      if (!user) {
        alert("You must be signed in.");
        return;
      }

      // Get the signed in user's Firestore document
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      // Stop if the user's Firestore data cannot be found
      if (!userSnap.exists()) {
        alert("Could not find user data.");
        return;
      }

      // Read the user's club IDs from Firestore
      const userData = userSnap.data();
      const clubIds: string[] = userData.clubIds || [];

      // Stop if the user is not in any clubs
      if (!clubIds.length) {
        alert("You are not in a club.");
        return;
      }

      // Right now, this uses the first club in the user's clubIds array
      const clubId = clubIds[0];

      // Add the new event document to the events collection
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

      // Go back to the previous screen after saving successfully
      router.back();
    } catch (e: any) {
      // Show any Firebase or save error message
      alert(e.message);
    } finally {
      // Turn off saving state whether the save works or fails
      setSaving(false);
    }
  };

  return (
    // Scrollable page so content still fits on smaller screens
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Screen heading */}
      <Text style={styles.title}>Add Event</Text>

      {/* Input for event title */}
      <TextInput
        placeholder="Event title"
        placeholderTextColor="#4B5563"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
      />

      {/* Input for event description */}
      <TextInput
        placeholder="Description"
        placeholderTextColor="#4B5563"
        value={description}
        onChangeText={setDescription}
        style={[styles.input, styles.multiline]}
        multiline
      />

      {/* Input for short location name shown on calendar cards */}
      <TextInput
        placeholder="Location name shown on calendar"
        placeholderTextColor="#4B5563"
        value={location}
        onChangeText={setLocation}
        style={styles.input}
      />

      {/* Opens the map picker screen so the user can choose an event location */}
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

      {/* Shows the full selected address only if one exists */}
      {!!locationAddress && (
        <View style={styles.addressBox}>
          <Text style={styles.addressLabel}>Selected address</Text>
          <Text style={styles.addressText}>{locationAddress}</Text>
        </View>
      )}

      {/* Toggle between all day events and timed events */}
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

      {/* Box that holds the date and optional time pickers */}
      <View style={styles.inlineContainer}>
        {/* Row to show and toggle the event date picker */}
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

        {/* Inline calendar picker for choosing the event day */}
        {showDatePicker && (
          <DateTimePicker
            value={eventDate}
            mode="date"
            display="inline"
            themeVariant="light"
            onChange={(event, selectedDate) => {
              if (!selectedDate) return;

              // Update the main event date
              const updatedEventDate = new Date(eventDate);
              updatedEventDate.setFullYear(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                selectedDate.getDate()
              );
              setEventDate(updatedEventDate);

              // Also move the timed event start and end to the same selected day
              setStartDate(prev => applySelectedDayToTime(prev, selectedDate));
              setEndDate(prev => applySelectedDayToTime(prev, selectedDate));
            }}
          />
        )}

        {/* Only show time settings if the event type is set to "time" */}
        {eventType === "time" && (
          <>
            {/* Row to show and toggle the start time picker */}
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

            {/* Inline time picker for the start time */}
            {showStartTimePicker && (
              <DateTimePicker
                value={startDate}
                mode="time"
                display="inline"
                themeVariant="light"
                onChange={(event, selectedDate) => {
                  if (!selectedDate) return;

                  // Update only the time portion of the start date
                  const updated = new Date(startDate);
                  updated.setHours(selectedDate.getHours());
                  updated.setMinutes(selectedDate.getMinutes());
                  updated.setSeconds(0);
                  updated.setMilliseconds(0);
                  setStartDate(updated);

                  // If the end time is no longer valid, automatically push it 1 hour later
                  if (endDate <= updated) {
                    const newEnd = new Date(updated);
                    newEnd.setHours(newEnd.getHours() + 1);
                    setEndDate(newEnd);
                  }
                }}
              />
            )}

            {/* Row to show and toggle the end time picker */}
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

            {/* Inline time picker for the end time */}
            {showEndTimePicker && (
              <DateTimePicker
                value={endDate}
                mode="time"
                display="inline"
                themeVariant="light"
                onChange={(event, selectedDate) => {
                  if (!selectedDate) return;

                  // Update only the time portion of the end date
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

      {/* Save event button */}
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

// Styles for the add event screen
const styles = StyleSheet.create({
  // Main page background
  container: {
    flex: 1,
    backgroundColor: "#dbeafe"
  },

  // Padding inside the scroll view
  contentContainer: {
    padding: 24,
    paddingBottom: 40
  },

  // Screen title style
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
    color: "#111827"
  },

  // Shared style for text inputs
  input: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB"
  },

  // Extra style for the multiline description box
  multiline: {
    minHeight: 90,
    textAlignVertical: "top"
  },

  // Button for opening the map picker
  mapButton: {
    backgroundColor: "#7b97d4",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10
  },

  // Text inside the map picker button
  mapButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600"
  },

  // Box that shows the selected address
  addressBox: {
    backgroundColor: "white",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 12,
    marginBottom: 12
  },

  // Small label above the full address
  addressLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4
  },

  // Full address text
  addressText: {
    fontSize: 14,
    color: "#111827"
  },

  // Container for all day vs time toggle buttons
  typeToggleWrap: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 4,
    marginBottom: 12
  },

  // Shared style for each toggle button
  typeToggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center"
  },

  // Active state for the selected toggle button
  typeToggleButtonActive: {
    backgroundColor: "#2563EB"
  },

  // Shared text style for toggle labels
  typeToggleText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151"
  },

  // Text color for active toggle
  typeToggleTextActive: {
    color: "white"
  },

  // Outer box for date and time rows
  inlineContainer: {
    backgroundColor: "white",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    marginBottom: 12,
    overflow: "hidden"
  },

  // Each clickable row for date, start time, and end time
  inlineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    borderTopWidth: 1,
    borderColor: "#E5E7EB"
  },

  // Removes the top border from the first row
  firstInlineRow: {
    borderTopWidth: 0
  },

  // Label text on the left side of each row
  inlineLabel: {
    fontSize: 16,
    color: "#111",
    fontWeight: "500"
  },

  // Value text on the right side of each row
  inlineValue: {
    fontSize: 16,
    color: "#2563EB"
  },

  // Save button style
  button: {
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 10,
    marginTop: 8
  },

  // Makes the button look faded while saving
  disabled: {
    opacity: 0.6
  },

  // Text inside the save button
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600"
  }
});