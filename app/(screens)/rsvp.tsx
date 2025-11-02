import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Linking,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { firestore } from "../../firebaseConfig";
import BottomNav from "../components/BottomNav";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface Guest {
  id: string;
  name: string;
  phone: string;
  status: string;
  guestCount?: number;
  vegetarian?: boolean;
  userId: string;
}

export default function RSVPPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [showStatusPrompt, setShowStatusPrompt] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [attending, setAttending] = useState(false);
  const [vegetarian, setVegetarian] = useState(false);
  const [guestCount, setGuestCount] = useState(1);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [weddingDate, setWeddingDate] = useState<string | null>(null);

  const guestsRef = collection(firestore, "guests");

  useEffect(() => {
    (async () => {
      const uid = await AsyncStorage.getItem("@uid");
      if (!uid) {
        Alert.alert("Error", "No user found. Please log in again.");
        return;
      }

      setUserId(uid);

      // 🔹 Fetch wedding date from user doc
      try {
        const userDoc = await getDoc(doc(firestore, "users", uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.weddingDate) {
            setWeddingDate(data.weddingDate);
          }
        }
      } catch (err) {
        console.log("Error fetching wedding date:", err);
      }

      // 🔹 Load QR image (if any)
      try {
        const qrDoc = await getDoc(doc(firestore, "qrCodes", uid));
        if (qrDoc.exists()) {
          const data = qrDoc.data();
          if (data.qrImageUrl) setQrImageUrl(data.qrImageUrl);
        }
      } catch (error) {
        console.log("Error fetching QR:", error);
      }

      fetchGuests(uid);
    })();
  }, []);

  const fetchGuests = async (uid: string) => {
    try {
      setLoading(true);
      const q = query(guestsRef, where("userId", "==", uid));
      const snapshot = await getDocs(q);
      const guestList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Guest[];
      setGuests(guestList);
    } catch (e) {
      console.log("Error loading guests:", e);
      Alert.alert("Error", "Failed to load guest list.");
    } finally {
      setLoading(false);
    }
  };

  const addGuest = async () => {
    if (!name || !phone) {
      Alert.alert("Missing Info", "Please enter both name and phone number.");
      return;
    }
    if (!userId) return;

    try {
      await addDoc(guestsRef, {
        name,
        phone,
        status: "Pending",
        guestCount: 1,
        vegetarian: false,
        userId,
      });
      setName("");
      setPhone("");
      setShowAddGuest(false);
      fetchGuests(userId);
    } catch (e) {
      console.log("Error adding guest:", e);
      Alert.alert("Error", "Failed to add guest.");
    }
  };

  const deleteGuest = async (id: string) => {
    try {
      await deleteDoc(doc(firestore, "guests", id));
      setGuests((prev) => prev.filter((g) => g.id !== id));
    } catch (e) {
      console.log("Error deleting guest:", e);
      Alert.alert("Error", "Failed to delete guest.");
    }
  };

  const uploadQRImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Please allow access to your photos.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || !result.assets[0].uri) return;
      if (!userId) {
        Alert.alert("Error", "User not found. Please log in again.");
        return;
      }

      const imageUri = result.assets[0].uri;
      const response = await fetch(imageUri);
      const blob = await response.blob();

      const storage = getStorage();
      const fileRef = ref(storage, `qrImages/${userId}_QR_${Date.now()}.jpg`);
      await uploadBytes(fileRef, blob);
      const downloadURL = await getDownloadURL(fileRef);

      // 🔥 Save the URL in Firestore
      await setDoc(doc(firestore, "qrCodes", userId), {
        qrImageUrl: downloadURL,
        updatedAt: new Date(),
      });

      setQrImageUrl(downloadURL);
      Alert.alert("Success", "QR image uploaded and saved!");
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Failed to upload QR image.");
    }
  };

  const sendWhatsAppInvite = (guest: Guest) => {
    let message = `Hi ${guest.name}! `;

    if (weddingDate) {
      message += `\nYou're invited to our wedding on ${weddingDate}! `;
    } else {
      message += `\nYou're invited to our wedding! `;
    }

    message += `\n\nPlease RSVP when you can.
Tap here to respond: https://smartwed-jj777.web.app/?id=${guest.id}`;

    if (qrImageUrl) {
      message += `\n\nOptional Gift QR: ${qrImageUrl}`;
    }

    const phoneNumber = guest.phone.replace(/\s|\+|-/g, "");
    Linking.openURL(
      `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
    );
  };

  const openStatusModal = (guest: Guest) => {
    setSelectedGuest(guest);
    setAttending(guest.status === "Attending");
    setGuestCount(guest.guestCount || 1);
    setVegetarian(guest.vegetarian || false);
    setShowStatusPrompt(true);
  };

  const saveRSVP = async () => {
    if (!selectedGuest || !userId) return;
    const newStatus = attending ? "Attending" : "Not Attending";
    await updateDoc(doc(firestore, "guests", selectedGuest.id), {
      status: newStatus,
      guestCount,
      vegetarian,
    });
    setShowStatusPrompt(false);
    fetchGuests(userId);
  };

  const renderGuest = ({ item }: { item: Guest }) => (
    <TouchableOpacity style={styles.guestCard} onPress={() => openStatusModal(item)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.guestName}>{item.name}</Text>
        <Text style={styles.guestStatus}>Status: {item.status}</Text>
        {item.status === "Attending" && (
          <>
            <Text style={styles.mealText}>Guests: {item.guestCount || 1}</Text>
            {item.vegetarian && <Text style={styles.mealText}>Vegetarian Meal</Text>}
          </>
        )}
      </View>

      <TouchableOpacity style={styles.iconBtn} onPress={() => sendWhatsAppInvite(item)}>
        <Ionicons name="logo-whatsapp" size={22} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.iconBtn, { backgroundColor: "#d6336c" }]}
        onPress={() => deleteGuest(item.id)}
      >
        <Ionicons name="trash" size={20} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RSVP Guest List</Text>

      {/* --- QR Upload Button + Modal --- */}
      <View style={{ alignItems: "center", marginVertical: 10 }}>
        <TouchableOpacity
          style={{
            backgroundColor: "#d6336c",
            padding: 15,
            borderRadius: 50,
            alignItems: "center",
            justifyContent: "center",
            width: 60,
            height: 60,
          }}
          onPress={() => {
            if (qrImageUrl) {
              setQrModalVisible(true);
            } else {
              uploadQRImage();
            }
          }}
        >
          <Ionicons name="qr-code-outline" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={{ marginTop: 8, color: "#444" }}>
          {qrImageUrl ? "View / Change QR" : "Upload QR"}
        </Text>
      </View>

      {/* QR Preview Modal */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          {qrImageUrl && (
            <Image
              source={{ uri: qrImageUrl }}
              style={{ width: 250, height: 250, borderRadius: 10 }}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={{
              backgroundColor: "#d6336c",
              paddingVertical: 10,
              paddingHorizontal: 20,
              borderRadius: 10,
              marginTop: 20,
            }}
            onPress={() => {
              setQrModalVisible(false);
              uploadQRImage(); // replace QR
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Replace QR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ marginTop: 10 }}
            onPress={() => setQrModalVisible(false)}
          >
            <Text style={{ color: "#ccc" }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Add Guest Modal */}
      <Modal visible={showAddGuest} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Guest</Text>
            <TextInput
              style={styles.input}
              placeholder="Guest Name"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#888"
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number (60123456789)"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              placeholderTextColor="#888"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addGuest}>
              <Text style={styles.addBtnText}>Add Guest</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowAddGuest(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* RSVP Switch Modal */}
      <Modal visible={showStatusPrompt} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Update RSVP</Text>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Attending</Text>
              <Switch
                value={attending}
                onValueChange={setAttending}
                thumbColor="#fff"
                trackColor={{ false: "#ccc", true: "#d6336c" }}
              />
            </View>

            {attending && (
              <>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Number of Guests</Text>
                  <TextInput
                    style={[styles.input, { width: 60, textAlign: "center" }]}
                    keyboardType="number-pad"
                    value={String(guestCount)}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 1;
                      setGuestCount(num < 1 ? 1 : num > 10 ? 10 : num);
                    }}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Vegetarian</Text>
                  <Switch
                    value={vegetarian}
                    onValueChange={setVegetarian}
                    thumbColor="#fff"
                    trackColor={{ false: "#ccc", true: "#d6336c" }}
                  />
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.addBtn, { marginTop: 20 }]}
              onPress={saveRSVP}
            >
              <Text style={styles.addBtnText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowStatusPrompt(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {loading ? (
        <ActivityIndicator size="large" color="#d6336c" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={guests}
          keyExtractor={(item) => item.id}
          renderItem={renderGuest}
          contentContainerStyle={{ paddingBottom: 160 }}
        />
      )}

      {/* Floating Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={() => setShowAddGuest(true)}>
          <Ionicons name="person-add" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#d6336c",
    marginBottom: 15,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#eee",
  },
  addBtn: {
    backgroundColor: "#d6336c",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  cancelBtn: { marginTop: 10, alignItems: "center" },
  cancelText: { color: "#999", fontWeight: "600" },
  guestCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8d7e5",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  guestName: { fontSize: 16, fontWeight: "600", color: "#333" },
  guestStatus: { fontSize: 14, color: "#666", marginTop: 2 },
  mealText: { fontSize: 13, color: "#999", marginTop: 2 },
  iconBtn: {
    backgroundColor: "#25D366",
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    width: "85%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#d6336c", marginBottom: 10 },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 8,
  },
  switchLabel: { fontSize: 16, color: "#333", fontWeight: "500" },
  fabContainer: {
    position: "absolute",
    bottom: 100,
    right: 25,
    alignItems: "center",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#d6336c",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
