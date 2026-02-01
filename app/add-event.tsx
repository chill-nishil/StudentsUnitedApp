import { db } from "@/FirebaseConfig";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { addDoc, collection } from "firebase/firestore";
import { useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";

export default function AddEventScreen() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

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
        placeholder="Location (optional)"
        placeholderTextColor="#4B5563"
        value={location}
        onChangeText={setLocation}
        style={styles.input}
      />

      {/* DATE + TIME CARD */}
      <View style={styles.inlineContainer}>
        {/* DATE ROW */}
        <Pressable
          style={styles.inlineRow}
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
              if (selectedDate) {
                setEventDate(selectedDate);
              }
            }}
          />
        )}

        {/* TIME ROW */}
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
              if (selectedDate) {
                setEventDate(selectedDate);
              }
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
    marginBottom: 20
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
