import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import React, { useState, useRef } from "react";
import {
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { auth, firestore, firebaseConfig } from "../../firebaseConfig";
import {
  PhoneAuthProvider,
  signInAnonymously,
  signInWithCredential,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";

export default function LandingPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmation, setConfirmation] = useState<any>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);

  const getFullPhone = (phone: string) => `+60${phone}`;
  const hashPassword = async (plain: string) =>
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, plain);

  // ======= REGISTER =======
  const handleRegister = async () => {
    if (!username || !phoneNumber || !password || !confirmPassword || !weddingDate) {
      alert("Please fill all fields, including your wedding date");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const q = query(
        collection(firestore, "users"),
        where("phoneNumber", "==", phoneNumber)
      );
      const qSnap = await getDocs(q);

      if (!qSnap.empty) {
        alert("Phone number already registered!");
        return;
      }

      const phoneProvider = new PhoneAuthProvider(auth);
      const id = await phoneProvider.verifyPhoneNumber(
        getFullPhone(phoneNumber),
        recaptchaVerifier.current as any
      );
      setConfirmation(id);
      alert(`Verification code sent to +60${phoneNumber}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const confirmCode = async () => {
    if (!confirmation) return;

    try {
      const credential = PhoneAuthProvider.credential(
        confirmation,
        verificationCode
      );
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      if (!user) {
        alert("User not found after verification.");
        return;
      }

      const hashedPassword = await hashPassword(password);
      await setDoc(doc(firestore, "users", user.uid), {
        username,
        phoneNumber,
        password: hashedPassword,
        weddingDate,
        isAdmin: false,
      });

      alert("Account created successfully!");
      setMode("login");
      setConfirmation(null);
      setVerificationCode("");
    } catch (err: any) {
      alert("Invalid verification code.");
    }
  };

  // ======= LOGIN =======
  const handleLogin = async () => {
    if (!phoneNumber || !password) {
      alert("Please enter both phone number and password.");
      return;
    }

    try {
      const q = query(
        collection(firestore, "users"),
        where("phoneNumber", "==", phoneNumber)
      );
      const qSnap = await getDocs(q);

      if (qSnap.empty) {
        alert("Phone number not registered!");
        return;
      }

      const userDoc = qSnap.docs[0];
      const userData = userDoc.data();
      const uid = userDoc.id;

      const hashedInput = await hashPassword(password);
      if (hashedInput !== userData.password) {
        alert("Incorrect password!");
        return;
      }

      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;

      await updateProfile(user, { displayName: userData.username });
      await AsyncStorage.setItem("@uid", uid);

      if (userData.isAdmin) {
        alert(`Welcome, Admin ${userData.username}! 👑`);
        router.replace("./AdminDashboard");
      } else {
        alert(`Welcome back, ${userData.username}! 🎉`);
        router.replace("./HomePage");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ======= FORGOT PASSWORD =======
  const handleForgotPassword = async () => {
    if (!phoneNumber) {
      alert("Enter your phone number.");
      return;
    }

    try {
      const q = query(
        collection(firestore, "users"),
        where("phoneNumber", "==", phoneNumber)
      );
      const qSnap = await getDocs(q);

      if (qSnap.empty) {
        alert("Phone number not registered!");
        return;
      }

      const fullPhone = getFullPhone(phoneNumber);
      const phoneProvider = new PhoneAuthProvider(auth);
      const id = await phoneProvider.verifyPhoneNumber(
        fullPhone,
        recaptchaVerifier.current as any
      );
      setConfirmation(id);
      alert(`Reset code sent to ${fullPhone}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const resetPassword = async () => {
    if (!confirmation) return;
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const credential = PhoneAuthProvider.credential(
        confirmation,
        verificationCode
      );
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      if (!user) {
        alert("User not found after verification.");
        return;
      }

      const hashedPassword = await hashPassword(password);
      await updateDoc(doc(firestore, "users", user.uid), {
        password: hashedPassword,
      });

      alert("Password reset successful! Please login again.");
      setMode("login");
      setConfirmation(null);
      setVerificationCode("");
      setPassword("");
      setConfirmPassword("");
      setPhoneNumber("");
    } catch (err: any) {
      alert("Invalid code or error resetting password.");
    }
  };

  // ======= UI =======
  return (
    <View style={styles.container}>
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseConfig}
      />

      <Text style={styles.title}>💍 SmartWed</Text>
      <Text style={styles.subtitle}>
        {mode === "login"
          ? "Welcome back! Please login to continue."
          : mode === "register"
          ? "Join us and start planning your dream wedding."
          : "Reset your password securely via SMS verification."}
      </Text>

      {/* Toggle */}
      {mode !== "forgot" && (
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, mode === "login" && styles.activeToggle]}
            onPress={() => {
              setMode("login");
              setConfirmation(null);
              setVerificationCode("");
            }}
          >
            <Text style={[styles.toggleText, mode === "login" && styles.activeText]}>
              Login
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, mode === "register" && styles.activeToggle]}
            onPress={() => {
              setMode("register");
              setConfirmation(null);
              setVerificationCode("");
            }}
          >
            <Text style={[styles.toggleText, mode === "register" && styles.activeText]}>
              Register
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Register fields */}
      {mode === "register" && !confirmation && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#888"
            value={username}
            onChangeText={setUsername}
          />

          <View style={styles.phoneContainer}>
            <Text style={styles.countryCode}>+60</Text>
            <TextInput
              style={styles.phoneInput}
              value={phoneNumber}
              onChangeText={(text) => setPhoneNumber(text.replace(/\D/g, "").slice(0, 9))}
              placeholder="123456789"
              placeholderTextColor="#888"
              keyboardType="phone-pad"
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#888"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
          />

          {/* WEDDING DATE PICKER */}
          <View style={{ width: "100%" }}>
            <TouchableOpacity
              style={[styles.input, { justifyContent: "center" }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: weddingDate ? "#000" : "#888" }}>
                {weddingDate ? `Wedding Date: ${weddingDate}` : "Select Wedding Date"}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={weddingDate ? new Date(weddingDate) : new Date()}
                mode="date"
                display="default"
                minimumDate={new Date()} // restricts past dates
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    const formattedDate = selectedDate.toISOString().split("T")[0];
                    setWeddingDate(formattedDate);
                  }
                }}
              />
            )}
          </View>

          <View style={styles.showPasswordContainer}>
            <Switch value={showPassword} onValueChange={setShowPassword} />
            <Text style={{ marginLeft: 8 }}>Show Password</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleRegister}>
            <Text style={styles.buttonText}>Register</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Confirmation step */}
      {mode === "register" && confirmation && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Enter verification code"
            value={verificationCode}
            onChangeText={(text) => setVerificationCode(text.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
          />
          <TouchableOpacity style={styles.button} onPress={confirmCode}>
            <Text style={styles.buttonText}>Confirm Code</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Login */}
      {mode === "login" && (
        <>
          <View style={styles.phoneContainer}>
            <Text style={styles.countryCode}>+60</Text>
            <TextInput
              style={styles.phoneInput}
              value={phoneNumber}
              onChangeText={(text) => setPhoneNumber(text.replace(/\D/g, "").slice(0, 9))}
              placeholder="123456789"
              placeholderTextColor="#888"
              keyboardType="phone-pad"
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />

          <View style={styles.showPasswordContainer}>
            <Switch value={showPassword} onValueChange={setShowPassword} />
            <Text style={{ marginLeft: 8 }}>Show Password</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setMode("forgot");
              setConfirmation(null);
              setVerificationCode("");
            }}
          >
            <Text style={{ color: "#d6336c", marginTop: 10 }}>Forgot Password?</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff0f6",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#d6336c",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginBottom: 30,
  },
  toggleContainer: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "#f8d7e5",
    borderRadius: 30,
    overflow: "hidden",
    width: "60%",
  },
  toggleButton: { flex: 1, paddingVertical: 10, alignItems: "center" },
  activeToggle: { backgroundColor: "#d6336c" },
  toggleText: { fontSize: 16, color: "#d6336c", fontWeight: "500" },
  activeText: { color: "#fff", fontWeight: "700" },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d6336c",
    borderRadius: 12,
    paddingHorizontal: 10,
    marginVertical: 10,
    width: "100%",
  },
  countryCode: { fontSize: 16, color: "#333", marginRight: 5 },
  phoneInput: { flex: 1, fontSize: 16, padding: 10 },
  input: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d6336c",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginVertical: 10,
    color: "#000",
  },
  button: {
    backgroundColor: "#d6336c",
    padding: 15,
    borderRadius: 30,
    alignItems: "center",
    width: "100%",
    marginTop: 15,
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  showPasswordContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    alignSelf: "flex-start",
  },
});
