import { auth, db } from "@/FirebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword
} from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      alert("Enter email and password");
      return;
    }

    try {
      setLoading(true);

      const cred = await signInWithEmailAndPassword(auth, email, password);

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

      router.push("/chat-dashboard");
    } catch (e) {
      alert("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      alert("Enter your email first");
      return;
    }

    try {
      setResettingPassword(true);
      await sendPasswordResetEmail(auth, trimmedEmail);
      alert("Password reset email sent");
    } catch (e: any) {
      alert("Could not send reset email");
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/logo.png")}
        style={styles.logoImage}
      />

      <View style={styles.card}>
        <TextInput
          placeholder="Email"
          placeholderTextColor="#4B5563"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />

        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Password"
            placeholderTextColor="#4B5563"
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

        <Pressable
          onPress={handleForgotPassword}
          disabled={resettingPassword}
          style={styles.forgotWrap}
        >
          <Text style={styles.forgotText}>
            {resettingPassword ? "Sending reset email..." : "Forgot Password?"}
          </Text>
        </Pressable>

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
          <Text style={styles.linkText}>New here? Create account!</Text>
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
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    backgroundColor: "white"
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12
  },
  forgotWrap: {
    alignSelf: "flex-start",
    marginBottom: 8
  },
  forgotText: {
    color: "#535353",
    fontSize: 14,
    textAlign: "left", 
    marginLeft: 4,
    marginTop: 4
  },
  logoImage: {
    width: 280,
    height: 200,
    alignSelf: "center",
    marginBottom: 24,
    resizeMode: "contain"
  }
});