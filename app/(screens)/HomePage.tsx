// app/(screens)/HomePage.tsx
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, firestore } from "../../firebaseConfig";

export default function HomePage() {
  const [username, setUsername] = useState("User");
  const [weddingDate, setWeddingDate] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const uid = await AsyncStorage.getItem("@uid");
        if (!uid) return;

        // Fetch user doc
        const userDocRef = doc(firestore, "users", uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          setUsername(data?.username || "User");
          setWeddingDate(data?.weddingDate || null); // 👈 Fetch wedding date if exists
        }
      } catch (e) {
        console.log("Failed to load user data:", e);
      }
    })();
  }, []);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("@uid");
      await signOut(auth);
    } catch (e) {
      console.log("Logout error:", e);
    }
    router.replace("../LandingPage");
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Welcome, {username}</Text>
        {weddingDate && (
          <Text style={styles.weddingDate}>
            💒 Wedding Date: {weddingDate}
          </Text>
        )}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Buttons Grid */}
      <View style={styles.buttonGrid}>
        <TouchableOpacity style={styles.button} onPress={() => router.push("/task-manager")}>
          <MaterialIcons name="checklist" size={40} />
          <Text style={styles.buttonText}>Task Manager</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => router.push("./rsvp")}>
          <MaterialIcons name="event" size={40} />
          <Text style={styles.buttonText}>RSVP</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => router.push("./vendors")}>
          <Ionicons name="people" size={40} />
          <Text style={styles.buttonText}>Vendors</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => router.push("./photo-gallery")}>
          <MaterialIcons name="photo-library" size={40} />
          <Text style={styles.buttonText}>Photo Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomButton} onPress={() => router.push("./HomePage")}>
          <Ionicons name="home" size={24} />
          <Text style={styles.bottomText}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomButton} onPress={() => router.push("/task-manager")}>
          <MaterialIcons name="checklist" size={24} />
          <Text style={styles.bottomText}>Tasks</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomButton} onPress={() => router.push("./rsvp")}>
          <MaterialIcons name="event" size={24} />
          <Text style={styles.bottomText}>RSVP</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomButton} onPress={() => router.push("./vendors")}>
          <Ionicons name="people" size={24} />
          <Text style={styles.bottomText}>Vendors</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomButton} onPress={() => router.push("./photo-gallery")}>
          <MaterialIcons name="photo-library" size={24} />
          <Text style={styles.bottomText}>Gallery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingBottom: 80, backgroundColor: "#fff" },
  header: {
    paddingTop: 48,
    paddingBottom: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  title: { fontSize: 24, fontWeight: "700", color: "#d6336c" },
  weddingDate: { fontSize: 20, color: "#d6336c", marginTop: 20, fontWeight: "500" },
  logoutButton: {
    position: "absolute",
    right: 0,
    top: 48,
    backgroundColor: "#d6336c",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  buttonGrid: {
    flex: 1,
    paddingTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignContent: "center",
  },
  button: {
    width: "48%",
    backgroundColor: "#f8d7e5",
    paddingVertical: 20,
    marginVertical: 10,
    borderRadius: 15,
    alignItems: "center",
    shadowColor: "#d6336c",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: { color: "#d6336c", fontSize: 16, fontWeight: "600", marginTop: 8 },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#f8d7e5",
    paddingVertical: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#d6336c",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomButton: { alignItems: "center" },
  bottomText: { fontSize: 12, fontWeight: "600", marginTop: 2, color: "#d6336c" },
});
