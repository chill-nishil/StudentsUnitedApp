import { auth, db } from "@/FirebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { useState } from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View
} from "react-native";

export default function CreateAccountScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [position, setPosition] = useState("");
  const [clubName, setClubName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPresident =
    position.trim().toLowerCase() === "president";

  const handleCreateAccount = async () => {
  console.log("CREATE ACCOUNT START");

  if (!name || !email || !password || !position) {
    alert("Please fill out all required fields");
    return;
  }

  if (isPresident && !clubName) {
    alert("Please enter your club name");
    return;
  }

  try {
    setLoading(true);

    console.log("CREATING AUTH USER");

    const cred = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const uid = cred.user.uid;
    console.log("AUTH USER CREATED:", uid);

    console.log("CREATING USER DOC");

    await setDoc(doc(db, "users", uid), {
      uid,
      name,
      email,
      position,
      clubName: isPresident ? clubName : null
    });

    console.log("USER DOC CREATED");

    if (isPresident) {
      console.log("CREATING CLUB");

      const clubRef = await addDoc(collection(db, "clubs"), {
        name: clubName,
        presidentUid: uid,
        members: [uid]
      });

      console.log("CLUB CREATED:", clubRef.id);

      await updateDoc(doc(db, "users", uid), {
        clubId: clubRef.id
      });

      console.log("USER UPDATED WITH CLUB ID");
    }

    router.push(`/chat-room?uid=${uid}`);
  } catch (e: any) {
    console.error("CREATE ACCOUNT ERROR:", e);
    alert(e.message);
  } finally {
    setLoading(false);
  }
};


  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={require("../assets/images/logo.png")}
            style={styles.logo}
          />

          <Text style={styles.title}>Create Account</Text>

          <TextInput
            placeholder="Full name"
            placeholderTextColor="#6B7280"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />

          <TextInput
            placeholder="School email"
            placeholderTextColor="#6B7280"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            style={styles.input}
          />

          <View style={styles.passwordContainer}>
            <TextInput
              placeholder="Create password"
              placeholderTextColor="#6B7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={styles.passwordInput}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={22}
                color="#6B7280"
              />
            </Pressable>
          </View>

          <TextInput
            placeholder="Position (e.g. President, Treasurer)"
            placeholderTextColor="#6B7280"
            value={position}
            onChangeText={setPosition}
            style={styles.input}
          />

          {isPresident && (
            <TextInput
              placeholder="Club name"
              placeholderTextColor="#6B7280"
              value={clubName}
              onChangeText={setClubName}
              style={styles.input}
            />
          )}

          <Pressable
            style={[styles.button, loading && styles.disabled]}
            onPress={handleCreateAccount}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Creating account..." : "Create Account"}
            </Text>
          </Pressable>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: "#dbeafe"
  },
  title: {
    fontWeight: "600",
    color: "#315680",
    fontSize: 20,
    textAlign: "center",
    marginBottom: 24
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "white"
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: "white"
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12
  },
  button: {
    backgroundColor: "#222",
    padding: 14,
    borderRadius: 8,
    marginTop: 8
  },
  disabled: {
    opacity: 0.6
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600"
  },
  logo: {
    width: 300,
    height: 280,
    alignSelf: "center",
    resizeMode: "contain"
  }
});
