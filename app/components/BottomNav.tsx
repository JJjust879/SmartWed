// app/components/BottomNav.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";


export default function BottomNav() {
  const router = useRouter();

  return (
    <View style={styles.bottomBar}>
      <TouchableOpacity style={styles.bottomButton} onPress={() => router.push("/HomePage")}>
        <Ionicons name="home" size={24} />
        <Text style={styles.bottomText}>Dashboard</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.bottomButton} onPress={() => router.push("/task-manager")}>
        <MaterialIcons name="checklist" size={24} />
        <Text style={styles.bottomText}>Tasks</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.bottomButton} onPress={() => router.push("/rsvp")}>
        <MaterialIcons name="event" size={24} />
        <Text style={styles.bottomText}>RSVP</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.bottomButton} onPress={() => router.push("/vendors")}>
        <Ionicons name="people" size={24} />
        <Text style={styles.bottomText}>Vendors</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.bottomButton} onPress={() => router.push("/photo-gallery")}>
        <MaterialIcons name="photo-library" size={24} />
        <Text style={styles.bottomText}>Gallery</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
