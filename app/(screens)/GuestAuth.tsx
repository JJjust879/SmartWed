import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function GuestAuth() {
  const [inputUid, setInputUid] = useState("");
  const [guestName, setGuestName] = useState("");
  const router = useRouter();

  const handleGo = async () => {
    if (!inputUid.trim() || !guestName.trim()) {
      return Alert.alert("Please enter both UID and Name");
    }

    await AsyncStorage.setItem("@guest_uid", inputUid.trim());
    await AsyncStorage.setItem("@guest_name", guestName.trim());

    router.replace("./GuestGallery");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter UID to view gallery</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        value={guestName}
        onChangeText={setGuestName}
      />

      <TextInput
        style={styles.input}
        placeholder="Enter UID"
        value={inputUid}
        onChangeText={setInputUid}
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.button} onPress={handleGo}>
        <Text style={styles.buttonText}>Go</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace("./LandingPage")}
      >
        <Text style={styles.backText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff0f6",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
    color: "#d6336c",
    textAlign: "center",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#d6336c",
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#d6336c",
    padding: 15,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  backButton: { padding: 12 },
  backText: { color: "#d6336c", fontWeight: "600" },
});
