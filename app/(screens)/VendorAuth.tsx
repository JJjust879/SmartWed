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

  const [mode, setMode] = useState<"register" | "login">("login");
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

  // Sign in anonymously for storage upload permissions
  useEffect(() => {
    const ensureAnonLogin = async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
          console.log("Signed in anonymously for uploads");
        }
      } catch (err) {
        console.error("Anonymous sign-in failed:", err);
      }
    };
    ensureAnonLogin();
  }, []);

  // Hash password before saving
  const hashPassword = async (password: string) => {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );
  };

  // Pick and upload proof image
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

  //Send verification code
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
      console.error("Registration error:", err);
      Alert.alert("Error", err.message);
    }
  };

  // Confirm code and save vendor
  const confirmCode = async () => {
    if (!verificationId) {
      Alert.alert("Error", "Please request a verification code first.");
      return;
    }

    try {
      const credential = PhoneAuthProvider.credential(
        verificationId,
        verificationCode
      );
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      if (!user || !user.uid) {
        Alert.alert("Error", "Vendor authentication failed. Please try again.");
        return;
      }

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

      setTimeout(() => {
        setModalVisible(false);
        Alert.alert("Success", "Vendor account created successfully!");
        router.replace("./VendorDashboard");
      }, 500);
    } catch (err: any) {
      console.error("Code confirmation error:", err);
      Alert.alert("Error", "Invalid verification code.");
    }
  };

  // Step 3️⃣ Login existing vendor
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

      const vendorDoc = qSnap.docs[0];
      const vendorData = vendorDoc.data();
      const hashedInput = await hashPassword(password);

      if (hashedInput !== vendorData.password) {
        Alert.alert("Error", "Incorrect password");
        return;
      }

      await AsyncStorage.setItem("@vendor_uid", vendorData.uid);

      Alert.alert("Success", "Login successful!");
      router.replace("./VendorDashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      Alert.alert("Error", err.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <FirebaseRecaptchaVerifierModal
          ref={recaptchaVerifier}
          firebaseConfig={expoFirebaseConfig}
        />

        <Text style={styles.title}>Vendor Portal</Text>
        <Text style={styles.subtitle}>
          {mode === "register"
            ? "Create your business account to start using SmartWed."
            : "Welcome back! Please log in to continue."}
        </Text>

        {/* Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, mode === "login" && styles.activeToggle]}
            onPress={() => setMode("login")}
          >
            <Text
              style={[styles.toggleText, mode === "login" && styles.activeText]}
            >
              Login
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, mode === "register" && styles.activeToggle]}
            onPress={() => setMode("register")}
          >
            <Text
              style={[styles.toggleText, mode === "register" && styles.activeText]}
            >
              Register
            </Text>
          </TouchableOpacity>
        </View>

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

            {/* Proof upload */}
            <TouchableOpacity
              style={[styles.button]}
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

        <View style={styles.phoneContainer}>
          <Text style={styles.countryCode}>+6</Text>
          <TextInput
            style={styles.phoneInput}
            placeholder="Phone (e.g. 0178792006)"
            keyboardType="phone-pad"
            onChangeText={setPhoneNumber}
          />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          onChangeText={setPassword}
        />

        {mode === "register" && (
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            secureTextEntry
            onChangeText={setConfirmPassword}
          />
        )}

        {mode === "register" ? (
          <TouchableOpacity style={styles.button} onPress={handleRegister}>
            <Text style={styles.buttonText}>Register & Send Code</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
        )}

        {mode === "login" && (
          <TouchableOpacity>
            <Text style={styles.linkText}>Forgot Password?</Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomContainer}>
          <Text style={styles.bottomText}>Are you a user?</Text>
          <TouchableOpacity onPress={() => router.replace("./LandingPage")}>
            <Text style={styles.bottomLink}>Go back</Text>
          </TouchableOpacity>
        </View>

        {/* Verification Modal */}
        <Modal transparent visible={modalVisible} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text
                style={{ fontSize: 18, fontWeight: "bold", color: "#d6336c" }}
              >
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
    width: "60%",
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
    padding: 15,
    borderRadius: 25,
    marginTop: 15,
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
