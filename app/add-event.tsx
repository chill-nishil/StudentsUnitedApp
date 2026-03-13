import { db } from "@/FirebaseConfig";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { addDoc, collection } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Pressable,
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

  const [eventDate, setEventDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
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

  const handleAddEvent = async () => {
    if (!title.trim() || !description.trim()) {
      alert("Please fill out title and description");
      return;
    }

    try {
      setSaving(true);

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
        date: eventDate
      });

      router.back();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
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

      <View style={styles.inlineContainer}>
        <Pressable
          style={[styles.inlineRow, styles.firstInlineRow]}
          onPress={() => {
            setShowDatePicker(!showDatePicker);
            setShowTimePicker(false);
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

              const updated = new Date(eventDate);
              updated.setFullYear(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                selectedDate.getDate()
              );
              setEventDate(updated);
            }}
          />
        )}

        <Pressable
          style={styles.inlineRow}
          onPress={() => {
            setShowTimePicker(!showTimePicker);
            setShowDatePicker(false);
          }}
        >
          <Text style={styles.inlineLabel}>Time</Text>
          <Text style={styles.inlineValue}>
            {eventDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit"
            })}
          </Text>
        </Pressable>

        {showTimePicker && (
          <DateTimePicker
            value={eventDate}
            mode="time"
            display="inline"
            themeVariant="light"
            onChange={(event, selectedDate) => {
              if (!selectedDate) return;

              const updated = new Date(eventDate);
              updated.setHours(selectedDate.getHours());
              updated.setMinutes(selectedDate.getMinutes());
              setEventDate(updated);
            }}
          />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#dbeafe"
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