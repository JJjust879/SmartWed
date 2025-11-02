import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Linking,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import { firestore } from "../../firebaseConfig";
import {
  collectionGroup,
  getDoc,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useRouter } from "expo-router";

export default function VendorDashboard() {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [vendorStatus, setVendorStatus] = useState("pending");
  const [view, setView] = useState<"appointments" | "info">("appointments");
  const [subView, setSubView] = useState<"upcoming" | "completed">("upcoming");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [rating, setRating] = useState(0);

  const router = useRouter();

  const fetchVendorInfo = useCallback(async (uid: string) => {
    try {
      const docRef = doc(firestore, "vendors", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const info = docSnap.data();
        setBusinessName(info.businessName || "");
        setDescription(info.description || "");
        setLocation(info.location || "");
        setContact(info.contact || "");
        setEmail(info.email || "");
        setVendorStatus(info.approved ? "approved" : "pending");
        setRating(info.rating || 0);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const uid = await AsyncStorage.getItem("@vendor_uid");
        if (!uid) {
          Alert.alert("Error", "Vendor not logged in!");
          router.replace("./VendorAuth");
          return;
        }
        setVendorId(uid);
        await fetchVendorInfo(uid);
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to load vendor data.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchVendorInfo]);

  useEffect(() => {
    if (!vendorId) return;

    const q = query(
      collectionGroup(firestore, "tasks"),
      where("vendorId", "==", vendorId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAppointments(data);
    });

    return () => unsubscribe();
  }, [vendorId]);

  const openWhatsApp = (phone: string) => {
    if (!phone) {
      Alert.alert("No phone number", "This customer has no phone number saved.");
      return;
    }

    let phoneNumber = phone.startsWith("+") ? phone : `+60${phone.replace(/^0+/, "")}`;
    const url = `https://wa.me/${phoneNumber}`;

    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "Unable to open WhatsApp.");
    });
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("@vendor_uid");
    router.replace("./VendorAuth");
  };

  const saveVendorInfo = async () => {
    if (!vendorId) return;
    try {
      let formattedContact = contact;
      if (!formattedContact.startsWith("+60")) {
        formattedContact = "+60" + formattedContact.replace(/^0+/, "");
      }

      await setDoc(
        doc(firestore, "vendors", vendorId),
        {
          businessName,
          description,
          location,
          contact: formattedContact,
          email,
        },
        { merge: true }
      );
      setContact(formattedContact);
      Alert.alert("Success", "Information saved successfully!");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to save information.");
    }
  };

  // Filter appointments based on completed status
  const displayedAppointments =
    subView === "completed"
      ? appointments.filter((a) => a.completed === true)
      : appointments.filter((a) => a.completed === false);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Vendor Dashboard</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.switchContainer}>
        <TouchableOpacity
          style={[styles.switchButton, view === "appointments" && styles.activeSwitch]}
          onPress={() => setView("appointments")}
        >
          <Text style={view === "appointments" ? styles.activeText : styles.inactiveText}>
            My Appointments
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.switchButton, view === "info" && styles.activeSwitch]}
          onPress={() => setView("info")}
        >
          <Text style={view === "info" ? styles.activeText : styles.inactiveText}>
            My Info
          </Text>
        </TouchableOpacity>
      </View>

      {view === "info" ? (
        <ScrollView style={{ marginTop: 10 }}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>
              Status:{" "}
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      vendorStatus === "approved"
                        ? "green"
                        : vendorStatus === "pending"
                        ? "orange"
                        : "gray",
                  },
                ]}
              >
                {vendorStatus === "approved" ? "Approved" : "Pending"}
              </Text>
            </Text>
            <Text style={styles.ratingText}>⭐ {rating.toFixed(1)}</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Business Name"
            value={businessName}
            onChangeText={setBusinessName}
          />
          <TextInput
            style={[styles.input, { height: 80 }]}
            placeholder="Description"
            value={description}
            multiline
            onChangeText={setDescription}
          />
          <TextInput
            style={styles.input}
            placeholder="Location"
            value={location}
            onChangeText={setLocation}
          />
          <View style={styles.phoneContainer}>
            <Text style={styles.prefix}>+60</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder="Contact Number"
              value={contact.startsWith("+60") ? contact.slice(3) : contact}
              onChangeText={(text) => setContact(text.replace(/\D/g, ""))}
              keyboardType="phone-pad"
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          <TouchableOpacity style={styles.saveButton} onPress={saveVendorInfo}>
            <Text style={styles.saveButtonText}>Save Information</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <>
          {/* mini tab for appointments */}
          <View style={styles.switchContainer}>
            <TouchableOpacity
              style={[styles.switchButton, subView === "upcoming" && styles.activeSwitch]}
              onPress={() => setSubView("upcoming")}
            >
              <Text style={subView === "upcoming" ? styles.activeText : styles.inactiveText}>
                Upcoming
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.switchButton, subView === "completed" && styles.activeSwitch]}
              onPress={() => setSubView("completed")}
            >
              <Text
                style={subView === "completed" ? styles.activeText : styles.inactiveText}
              >
                Completed
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={displayedAppointments}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.emptyText}>No appointments yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.name}>{item.customerName || "Unknown"}</Text>
                <Text>
                  📅 Date:{" "}
                  {item.dueDate?.toDate?.().toLocaleString?.() ||
                    item.appointmentDate?.toDate?.().toLocaleString?.() ||
                    "N/A"}
                </Text>
                <Text>📞 Phone: +60{item.customerPhone || "N/A"}</Text>

                {item.completed && (
                  <Text style={{ color: "green", marginTop: 5, fontWeight: "bold" }}>
                    ✅ Completed
                  </Text>
                )}

                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={() => openWhatsApp(item.customerPhone || "")}
                >
                  <Text style={styles.chatButtonText}>Chat on WhatsApp</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff0f6", padding: 20 },
  title: { fontSize: 26, fontWeight: "bold", color: "#d6336c" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  logoutButton: {
    backgroundColor: "#d6336c",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logoutText: { color: "#fff", fontSize: 14 },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 15,
    gap: 10,
  },
  switchButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "#ffe3ec",
  },
  activeSwitch: { backgroundColor: "#d6336c" },
  activeText: { color: "#fff", fontWeight: "600" },
  inactiveText: { color: "#d6336c", fontWeight: "600" },
  emptyText: { textAlign: "center", color: "#888", marginTop: 50 },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  name: { fontSize: 18, fontWeight: "bold", color: "#333" },
  chatButton: {
    backgroundColor: "#25D366",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  chatButtonText: { color: "#fff", fontWeight: "bold" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    marginVertical: 6,
    paddingLeft: 10,
  },
  prefix: { color: "#d6336c", fontWeight: "600", marginRight: 6 },
  phoneInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 5 },
  saveButton: {
    backgroundColor: "#d6336c",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  statusLabel: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  statusText: { fontWeight: "700" },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f5a623",
  },
});
