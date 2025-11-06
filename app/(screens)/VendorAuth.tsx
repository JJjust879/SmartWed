import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
import {
  PhoneAuthProvider,
  signInWithCredential,
  signInAnonymously,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { auth, firestore, storage } from "../../firebaseConfig";

const expoFirebaseConfig = {
  apiKey: "AIzaSyAnFi4kIUZFq5AzK3sEWLjREE5bEMx2Jls",
  authDomain: "smartwed-jj777.firebaseapp.com",
  projectId: "smartwed-jj777",
  storageBucket: "smartwed-jj777.appspot.com",
  messagingSenderId: "558059387787",
  appId: "1:558059387787:android:fa21cd606660d2d8d60d8e",
};

export default function VendorAuth() {
  const router = useRouter();
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);

  const [mode, setMode] = useState<"register" | "login" | "forgot">("login");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const ensureAnonLogin = async () => {
      try {
        if (!auth.currentUser) await signInAnonymously(auth);
      } catch (err) {
        console.error("Anonymous sign-in failed:", err);
      }
    };
    ensureAnonLogin();
  }, []);

  const hashPassword = async (password: string) => {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );
  };

  const handleUploadProof = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setUploading(true);
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const anonUid = auth.currentUser?.uid || "unknown";
      const proofRef = ref(storage, `vendorProofs/${anonUid}/${Date.now()}.jpg`);
      await uploadBytes(proofRef, blob);
      const downloadURL = await getDownloadURL(proofRef);
      setProofUri(downloadURL);
      setUploading(false);
      Alert.alert("Success", "Proof of business uploaded successfully!");
    } catch (err) {
      console.error("Upload error:", err);
      Alert.alert("Error", "Failed to upload image.");
      setUploading(false);
    }
  };

  const handleRegister = async () => {
    if (
      !businessName ||
      !category ||
      !phoneNumber ||
      !password ||
      !confirmPassword ||
      !proofUri
    ) {
      Alert.alert("Error", "Please fill all fields and upload proof");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    try {
      const q = query(
        collection(firestore, "vendors"),
        where("phoneNumber", "==", phoneNumber)
      );
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        Alert.alert("Error", "Phone number already registered!");
        return;
      }
      const phoneProvider = new PhoneAuthProvider(auth);
      const id = await phoneProvider.verifyPhoneNumber(
        "+6" + phoneNumber,
        recaptchaVerifier.current as any
      );
      setVerificationId(id);
      setModalVisible(true);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const confirmCode = async () => {
    if (!verificationId) return;
    try {
      const credential = PhoneAuthProvider.credential(
        verificationId,
        verificationCode
      );
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;
      const hashedPassword = await hashPassword(password);
      const fullPhone = phoneNumber.startsWith("+6")
        ? phoneNumber
        : `+6${phoneNumber}`;
      const vendorData = {
        uid: user.uid,
        businessName,
        category,
        phoneNumber: fullPhone,
        password: hashedPassword,
        proofOfBusiness: proofUri,
        approved: false,
        rating: 0,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(firestore, "vendors", user.uid), vendorData);
      await AsyncStorage.setItem("@vendor_uid", user.uid);
      setModalVisible(false);
      Alert.alert("Success", "Vendor account created successfully!");
      router.replace("./VendorDashboard");
    } catch (err) {
      Alert.alert("Error", "Invalid verification code.");
    }
  };

  const handleLogin = async () => {
    if (!phoneNumber || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    try {
      const fullPhone = phoneNumber.startsWith("+6")
        ? phoneNumber
        : `+6${phoneNumber}`;
      const q = query(
        collection(firestore, "vendors"),
        where("phoneNumber", "==", fullPhone)
      );
      const qSnap = await getDocs(q);
      if (qSnap.empty) {
        Alert.alert("Error", "Vendor not found. Please register first.");
        return;
      }
      const vendorData = qSnap.docs[0].data();
      const hashedInput = await hashPassword(password);
      if (hashedInput !== vendorData.password) {
        Alert.alert("Error", "Incorrect password");
        return;
      }
      await AsyncStorage.setItem("@vendor_uid", vendorData.uid);
      Alert.alert("Success", "Login successful!");
      router.replace("./VendorDashboard");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  // 🔐 Forgot Password flow
  const handleForgotPassword = async () => {
    if (!phoneNumber) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }
    try {
      const phoneProvider = new PhoneAuthProvider(auth);
      const id = await phoneProvider.verifyPhoneNumber(
        "+6" + phoneNumber,
        recaptchaVerifier.current as any
      );
      setVerificationId(id);
      Alert.alert("Code Sent", "Verification code sent to your phone");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const resetPassword = async () => {
    if (!verificationId || !verificationCode) {
      Alert.alert("Error", "Please verify your phone first");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    try {
      const credential = PhoneAuthProvider.credential(
        verificationId,
        verificationCode
      );
      await signInWithCredential(auth, credential);
      const fullPhone = phoneNumber.startsWith("+6")
        ? phoneNumber
        : `+6${phoneNumber}`;
      const q = query(
        collection(firestore, "vendors"),
        where("phoneNumber", "==", fullPhone)
      );
      const qSnap = await getDocs(q);
      if (qSnap.empty) {
        Alert.alert("Error", "Vendor not found");
        return;
      }
      const docRef = qSnap.docs[0].ref;
      const hashedNew = await hashPassword(password);
      await updateDoc(docRef, { password: hashedNew });
      Alert.alert("Success", "Password reset successfully!");
      setMode("login");
    } catch (err: any) {
      Alert.alert("Error", "Invalid code or reset failed");
    }
  };

  return (
    <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === "ios" ? "padding" : undefined}
  >
    <ScrollView contentContainerStyle={styles.container}>
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={expoFirebaseConfig}
      />
      <Text style={styles.title}>Vendor Portal</Text>
      <Text style={styles.subtitle}>
        {mode === "register"
          ? "Create your business account to get started."
          : mode === "forgot"
          ? "Reset your password easily."
          : "Welcome back! Please log in to continue."}
      </Text>

      {/* Toggle (hide when forgot mode) */}
      {mode !== "forgot" && (
        <View style={styles.toggleContainer}>
          {["login", "register"].map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleButton, mode === m && styles.activeToggle]}
              onPress={() => setMode(m as any)}
            >
              <Text
                style={[styles.toggleText, mode === m && styles.activeText]}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Register Section */}
      {mode === "register" && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Business Name"
            onChangeText={setBusinessName}
          />
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={category}
              onValueChange={setCategory}
              style={styles.picker}
            >
              <Picker.Item label="Select Category" value="" />
              <Picker.Item label="Venue" value="Venue" />
              <Picker.Item label="Decoration" value="Decoration" />
              <Picker.Item label="F&B" value="F&B" />
              <Picker.Item label="Photography" value="Photography" />
              <Picker.Item label="Attire & Beauty" value="Attire & Beauty" />
            </Picker>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleUploadProof}
            disabled={uploading}
          >
            <Text style={styles.buttonText}>
              {uploading ? "Uploading..." : "Upload Proof of Business"}
            </Text>
          </TouchableOpacity>

          {proofUri && (
            <Image
              source={{ uri: proofUri }}
              style={{
                width: 200,
                height: 200,
                marginTop: 10,
                borderRadius: 10,
              }}
            />
          )}
        </>
      )}

      {/* Phone Input */}
      <View style={styles.phoneContainer}>
        <Text style={styles.countryCode}>+6</Text>
        <TextInput
          style={styles.phoneInput}
          placeholder="Phone (e.g. 0178792006)"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />
      </View>

      {/* Password + Actions */}
      {mode === "login" && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode("forgot")}>
            <Text style={styles.linkText}>Forgot Password?</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === "register" && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            secureTextEntry
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity style={styles.button} onPress={handleRegister}>
            <Text style={styles.buttonText}>Register & Send Code</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Forgot Password Section */}
      {mode === "forgot" && (
        <>
          {!verificationId && (
            <TouchableOpacity style={styles.button} onPress={handleForgotPassword}>
              <Text style={styles.buttonText}>Send Verification Code</Text>
            </TouchableOpacity>
          )}

          {verificationId && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Verification Code"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="New Password"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Switch value={showPassword} onValueChange={setShowPassword} />
                <Text style={{ marginLeft: 8 }}>Show Password</Text>
              </View>
              <TouchableOpacity style={styles.button} onPress={resetPassword}>
                <Text style={styles.buttonText}>Reset Password</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => setMode("login")}>
            <Text style={styles.linkText}>← Back to Login</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Bottom only when not forgot */}
      {mode !== "forgot" && (
        <View style={styles.bottomContainer}>
          <Text style={styles.bottomText}>Are you a user?</Text>
          <TouchableOpacity onPress={() => router.replace("./LandingPage")}>
            <Text style={styles.bottomLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal */}
      <Modal transparent visible={modalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: "#d6336c" }}>
              Enter Verification Code
            </Text>
            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              placeholder="6-digit code"
              keyboardType="number-pad"
              onChangeText={setVerificationCode}
            />
            <View style={{ flexDirection: "row", marginTop: 15 }}>
              <TouchableOpacity
                style={[styles.button, { flex: 1, marginRight: 5 }]}
                onPress={confirmCode}
              >
                <Text style={styles.buttonText}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { flex: 1, backgroundColor: "#aaa" }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff0f6",
    paddingBottom: 80,
  },
  title: { fontSize: 30, fontWeight: "bold", color: "#d6336c" },
  subtitle: { textAlign: "center", color: "#555", marginVertical: 10 },
  toggleContainer: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "#f8d7e5",
    borderRadius: 30,
    overflow: "hidden",
    width: "90%",
  },
  toggleButton: { flex: 1, alignItems: "center", paddingVertical: 10 },
  activeToggle: { backgroundColor: "#d6336c" },
  toggleText: { color: "#d6336c", fontWeight: "600" },
  activeText: { color: "#fff" },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d6336c",
    borderRadius: 10,
    marginVertical: 10,
    paddingHorizontal: 10,
    width: "100%",
  },
  countryCode: { color: "#333" },
  phoneInput: { flex: 1, padding: 10 },
  pickerContainer: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d6336c",
    borderRadius: 10,
    marginVertical: 8,
  },
  picker: { width: "100%" },
  input: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d6336c",
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
  },
  button: {
    backgroundColor: "#d6336c",
    padding: 14,
    borderRadius: 25,
    marginTop: 10,
    width: "100%",
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
  linkText: {
    color: "#d6336c",
    marginTop: 10,
    textDecorationLine: "underline",
  },
  bottomContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 30,
  },
  bottomText: { color: "#555", marginRight: 5 },
  bottomLink: {
    color: "#d6336c",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 15,
    width: "80%",
    alignItems: "center",
  },
});
