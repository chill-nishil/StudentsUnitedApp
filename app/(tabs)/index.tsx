import { auth, db } from "@/FirebaseConfig";
import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      alert("Enter email and password");
      return;
    }

    try {
      setLoading(true);

      const cred = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const q = query(
        collection(db, "users"),
        where("uid", "==", cred.user.uid)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        alert("User profile not found");
        setLoading(false);
        return;
      }

      router.push(`/chat?uid=${cred.user.uid}`);
    } catch (e) {
      alert("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>STUDENTS UNITED</Text>
      <Text style={styles.subtitle}>Stronger Together</Text>

      <View style={styles.card}>
        <TextInput
          placeholder="Email"
          placeholderTextColor="#4B5563"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          style={styles.input}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#4B5563"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />

        <Pressable
          style={[styles.button, loading && styles.disabled]}
          onPress={handleSignIn}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Signing in..." : "Sign In"}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.push("/create-account")}>
          <Text style={styles.linkText}>New here? Create account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    padding: 24
  },
  logo: {
    fontSize: 28,
    textAlign: "center",
    fontWeight: "700",
    marginBottom: 4
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 32
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12
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
  linkText: {
    marginTop: 12,
    textAlign: "center"
  }
});
