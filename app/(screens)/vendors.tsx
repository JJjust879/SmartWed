import React, { useEffect, useState, createContext, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  getDoc,
  setDoc,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { app } from "../../firebaseConfig";
import BottomNav from "../components/BottomNav";

const firestore = getFirestore(app);
const Tab = createMaterialTopTabNavigator();

/* -------------------- Types -------------------- */
interface Vendor {
  id: string;
  businessName: string;
  description?: string;
  location?: string;
  email?: string;
  phoneNumber?: string;
  contact?: string;
  category?: string;
  approved?: string;
  rating?: number;
}

/* -------------------- Follow Context -------------------- */
interface FollowContextType {
  userId: string | null;
  followedIds: string[];
  toggleFollow: (vendorId: string) => void;
}

const FollowContext = createContext<FollowContextType | null>(null);

const FollowProvider = ({ children }: { children: React.ReactNode }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [followedIds, setFollowedIds] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem("@uid").then(setUserId);
  }, []);

  useEffect(() => {
    if (!userId) return;
    const fetchFollowed = async () => {
      const q = query(collection(firestore, "followedVendors"), where("userId", "==", userId));
      const snap = await getDocs(q);
      setFollowedIds(snap.docs.map((d) => d.data().vendorId));
    };
    fetchFollowed();
  }, [userId]);

  const toggleFollow = async (vendorId: string) => {
    if (!userId) return Alert.alert("Please log in to follow vendors.");
    const isFollowed = followedIds.includes(vendorId);

    try {
      if (isFollowed) {
        const q = query(
          collection(firestore, "followedVendors"),
          where("userId", "==", userId),
          where("vendorId", "==", vendorId)
        );
        const snap = await getDocs(q);
        snap.docs.forEach((d) => deleteDoc(doc(firestore, "followedVendors", d.id)));
        setFollowedIds((prev) => prev.filter((id) => id !== vendorId));
      } else {
        await addDoc(collection(firestore, "followedVendors"), {
          userId,
          vendorId,
          followedAt: new Date().toISOString(),
        });
        setFollowedIds((prev) => [...prev, vendorId]);
      }
    } catch (err) {
      console.error("Error updating follow:", err);
    }
  };

  return (
    <FollowContext.Provider value={{ userId, followedIds, toggleFollow }}>
      {children}
    </FollowContext.Provider>
  );
};

/* -------------------- Star Rating -------------------- */
const StarRating = ({
  rating,
  setRating,
}: {
  rating: number;
  setRating: (v: number) => void;
}) => (
  <View style={{ flexDirection: "row", justifyContent: "center", marginVertical: 10 }}>
    {[1, 2, 3, 4, 5].map((star) => (
      <TouchableOpacity key={star} onPress={() => setRating(star)}>
        <Ionicons
          name={star <= rating ? "star" : "star-outline"}
          size={32}
          color={star <= rating ? "#FFD700" : "#ccc"}
          style={{ marginHorizontal: 3 }}
        />
      </TouchableOpacity>
    ))}
  </View>
);

/* -------------------- Main Vendors Screen -------------------- */
export default function VendorsScreen() {
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [ratingValue, setRatingValue] = useState(0);

  const openRatingModal = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setRatingValue(0);
  };
  const closeRatingModal = () => setSelectedVendor(null);

  const submitRating = async () => {
    if (!selectedVendor || ratingValue <= 0)
      return Alert.alert("Please select a star rating.");

    const uid = await AsyncStorage.getItem("@uid");
    if (!uid) return Alert.alert("Please log in to rate vendors.");

    const ratingDoc = doc(firestore, "vendors", selectedVendor.id, "ratings", uid);
    await setDoc(ratingDoc, { rating: ratingValue }, { merge: true });

    // Update average rating
    const ratingsSnap = await getDocs(collection(firestore, "vendors", selectedVendor.id, "ratings"));
    const ratings = ratingsSnap.docs.map((d) => d.data().rating as number);
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    await setDoc(doc(firestore, "vendors", selectedVendor.id), { rating: avgRating }, { merge: true });

    Alert.alert("Thank you!", "Your rating has been submitted.");
    closeRatingModal();
  };

  return (
    <FollowProvider>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: "#d6336c",
          tabBarIndicatorStyle: { backgroundColor: "#d6336c" },
          tabBarStyle: { backgroundColor: "#fff0f6" },
          tabBarLabelStyle: { fontWeight: "bold" },
        }}
      >
        <Tab.Screen name="Browse">
          {(props) => <BrowseVendors {...props} onViewRating={openRatingModal} />}
        </Tab.Screen>
        <Tab.Screen name="Followed">
          {(props) => <FollowedVendors {...props} onViewRating={openRatingModal} />}
        </Tab.Screen>
      </Tab.Navigator>

      {/* Rating Modal */}
      <Modal visible={!!selectedVendor} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>{selectedVendor?.businessName}</Text>
            <Text style={{ marginBottom: 6 }}>{selectedVendor?.description}</Text>
            <Text>📍 {selectedVendor?.location}</Text>
            <Text>✉️ {selectedVendor?.email}</Text>
            <Text>📞 {selectedVendor?.phoneNumber}</Text>
            <Text style={{ marginTop: 12, textAlign: "center", fontWeight: "600" }}>
              ⭐ Current Rating: {selectedVendor?.rating?.toFixed(1) || "0.0"}
            </Text>
            <Text style={{ textAlign: "center", marginTop: 8 }}>Tap to rate this vendor:</Text>
            <StarRating rating={ratingValue} setRating={setRatingValue} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.addButtonTop, { flex: 1, marginRight: 5 }]} onPress={submitRating}>
                <Text style={{ color: "#fff", textAlign: "center" }}>Submit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteButton, { flex: 1, marginLeft: 5 }]} onPress={closeRatingModal}>
                <Text style={{ color: "#fff", textAlign: "center" }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </FollowProvider>
  );
}

/* -------------------- Browse Vendors -------------------- */
function BrowseVendors({ onViewRating }: { onViewRating: (vendor: Vendor) => void }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const { followedIds, toggleFollow, userId } = useContext(FollowContext)!;

  // Booking state
  const [showBooking, setShowBooking] = useState(false);
  const [selectedVendorBooking, setSelectedVendorBooking] = useState<Vendor | null>(null);
  const [appointmentDate, setAppointmentDate] = useState<Date | null>(null);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [appointmentNote, setAppointmentNote] = useState("");

  const categories = ["All", "Venue", "Decoration", "F&B", "Photography", "Attire & Beauty"];

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const q = query(collection(firestore, "vendors"), where("approved", "==", "Yes"));
        const snap = await getDocs(q);
        const vendorsData: Vendor[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vendor));

        // Compute average ratings
        for (const vendor of vendorsData) {
          const ratingsSnap = await getDocs(collection(firestore, "vendors", vendor.id, "ratings"));
          vendor.rating = !ratingsSnap.empty
            ? ratingsSnap.docs.map((r) => r.data().rating as number).reduce((a, b) => a + b, 0) / ratingsSnap.size
            : 0;
        }
        setVendors(vendorsData);
      } catch (err) {
        console.error("Error fetching vendors:", err);
      }
    };
    fetchVendors();
  }, []);

  const openWhatsApp = (vendor: Vendor) => {
    const phone = vendor.contact || vendor.phoneNumber;
    if (!phone) return Alert.alert("This vendor has not provided a contact number.");
    Linking.openURL(`https://wa.me/${phone.toString().replace(/\s|\+|-/g, "")}`);
  };

  const openBookingModal = (vendor: Vendor) => {
    setSelectedVendorBooking(vendor);
    setShowBooking(true);
  };

  const scheduleNotification = async (vendorName: string, date: Date) => {
    const triggerTime = new Date(date.getTime() - 10 * 60 * 1000);
    if (triggerTime > new Date()) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "Upcoming Appointment", body: `You have an appointment with ${vendorName} soon!` },
        trigger: { 
          type: Notifications.SchedulableTriggerInputTypes.DATE, 
          date: triggerTime, },
      });
    }
  };

  const bookAppointment = async () => {
    if (!appointmentDate || !selectedVendorBooking)
      return Alert.alert("Please select a date and time for your appointment.");

    const uid = await AsyncStorage.getItem("@uid");
    if (!uid) return Alert.alert("Please log in to book an appointment.");

    const userDoc = await getDoc(doc(firestore, "users", uid));
    const customerData = userDoc.exists() ? userDoc.data() : {};
    const taskRef = collection(firestore, "users", uid, "tasks");

    await addDoc(taskRef, {
      title: `Appointment with ${selectedVendorBooking.businessName}`,
      note: appointmentNote,
      dueDate: Timestamp.fromDate(appointmentDate),
      completed: false,
      createdAt: serverTimestamp(),
      vendorId: selectedVendorBooking.id,
      vendorName: selectedVendorBooking.businessName,
      customerName: customerData?.username || "Anonymous",
      customerPhone: customerData?.phoneNumber || "",
    });

    await scheduleNotification(selectedVendorBooking.businessName, appointmentDate);
    Alert.alert("Task Created!", "Your booking has been added to your Task Manager.");

    setShowBooking(false);
    setAppointmentDate(null);
    setAppointmentNote("");
  };

  const filteredVendors = selectedCategory === "All" ? vendors : vendors.filter((v) => v.category === selectedCategory);

  return (
    <View style={styles.container}>
      {/* Categories */}
      <View style={styles.categoryTabs}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryButton, selectedCategory === cat && styles.categoryButtonActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Vendor List */}
      <FlatList
        data={filteredVendors}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VendorCard
            vendor={item}
            isFollowed={followedIds.includes(item.id)}
            onFollow={() => toggleFollow(item.id)}
            onContact={() => openWhatsApp(item)}
            onBook={() => openBookingModal(item)}
            onView={() => onViewRating(item)}
          />
        )}
      />

      {/* Booking Modal */}
      <Modal visible={showBooking} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Book Appointment with {selectedVendorBooking?.businessName}</Text>

            <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateText}>{appointmentDate ? appointmentDate.toLocaleString() : "Select Date & Time"}</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={new Date()}
                mode="date"
                display="calendar"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (event.type !== "dismissed" && date) {
                    setTempDate(date);
                    setShowTimePicker(true);
                  }
                }}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={tempDate || new Date()}
                mode="time"
                display="spinner"
                onChange={(event, time) => {
                  setShowTimePicker(false);
                  if (event.type !== "dismissed" && tempDate && time) {
                    const combined = new Date(tempDate);
                    combined.setHours(time.getHours());
                    combined.setMinutes(time.getMinutes());
                    setAppointmentDate(combined);
                  }
                }}
              />
            )}

            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Add a note (optional)"
              value={appointmentNote}
              onChangeText={setAppointmentNote}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.addButtonTop, { flex: 1, marginRight: 5 }]} onPress={bookAppointment}>
                <Text style={{ color: "#fff", textAlign: "center" }}>Book</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteButton, { flex: 1, marginLeft: 5 }]} onPress={() => setShowBooking(false)}>
                <Text style={{ color: "#fff", textAlign: "center" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav />
    </View>
  );
}

/* -------------------- Followed Vendors -------------------- */
function FollowedVendors({ onViewRating }: { onViewRating: (vendor: Vendor) => void }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const { followedIds, toggleFollow } = useContext(FollowContext)!;

  // Booking modal state
  const [showBooking, setShowBooking] = useState(false);
  const [selectedVendorBooking, setSelectedVendorBooking] = useState<Vendor | null>(null);
  const [appointmentDate, setAppointmentDate] = useState<Date | null>(null);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [appointmentNote, setAppointmentNote] = useState("");

  useEffect(() => {
    const fetchVendors = async () => {
      const snap = await getDocs(collection(firestore, "vendors"));
      setVendors(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vendor)));
    };
    fetchVendors();
  }, []);

  const openWhatsApp = (vendor: Vendor) => {
    const phone = vendor.contact || vendor.phoneNumber;
    if (!phone) return Alert.alert("This vendor has not provided a contact number.");
    Linking.openURL(`https://wa.me/${phone.toString().replace(/\s|\+|-/g, "")}`);
  };

  const openBookingModal = (vendor: Vendor) => {
    setSelectedVendorBooking(vendor);
    setShowBooking(true);
  };

  const bookAppointment = async () => {
    if (!appointmentDate || !selectedVendorBooking)
      return Alert.alert("Please select a date and time for your appointment.");

    const uid = await AsyncStorage.getItem("@uid");
    if (!uid) return Alert.alert("Please log in to book an appointment.");

    const userDoc = await getDoc(doc(firestore, "users", uid));
    const customerData = userDoc.exists() ? userDoc.data() : {};
    const taskRef = collection(firestore, "users", uid, "tasks");

    await addDoc(taskRef, {
      title: `Appointment with ${selectedVendorBooking.businessName}`,
      note: appointmentNote,
      dueDate: Timestamp.fromDate(appointmentDate),
      completed: false,
      createdAt: serverTimestamp(),
      vendorId: selectedVendorBooking.id,
      vendorName: selectedVendorBooking.businessName,
      customerName: customerData?.username || "Anonymous",
      customerPhone: customerData?.phoneNumber || "",
    });

    Alert.alert("Task Created!", "Your booking has been added to your Task Manager.");

    // Reset modal state
    setShowBooking(false);
    setAppointmentDate(null);
    setAppointmentNote("");
  };

  const followedList = vendors.filter((v) => followedIds.includes(v.id));

  return (
    <View style={styles.container}>
      {followedList.length === 0 ? (
        <Text style={{ textAlign: "center", color: "#555", marginTop: 50 }}>
          You haven’t followed any vendors yet.
        </Text>
      ) : (
        <FlatList
          data={followedList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <VendorCard
              vendor={item}
              isFollowed
              onFollow={() => toggleFollow(item.id)}
              onContact={() => openWhatsApp(item)}
              onView={() => onViewRating(item)}
              onBook={() => openBookingModal(item)}
            />
          )}
        />
      )}

      {/* Booking Modal */}
      <Modal visible={showBooking} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>
              Book Appointment with {selectedVendorBooking?.businessName}
            </Text>

            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateText}>
                {appointmentDate
                  ? appointmentDate.toLocaleString()
                  : "Select Date & Time"}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={new Date()}
                mode="date"
                display="calendar"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (event.type !== "dismissed" && date) {
                    setTempDate(date);
                    setShowTimePicker(true);
                  }
                }}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={tempDate || new Date()}
                mode="time"
                display="spinner"
                onChange={(event, time) => {
                  setShowTimePicker(false);
                  if (event.type !== "dismissed" && tempDate && time) {
                    const combined = new Date(tempDate);
                    combined.setHours(time.getHours());
                    combined.setMinutes(time.getMinutes());
                    setAppointmentDate(combined);
                  }
                }}
              />
            )}

            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Add a note (optional)"
              value={appointmentNote}
              onChangeText={setAppointmentNote}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.addButtonTop, { flex: 1, marginRight: 5 }]}
                onPress={bookAppointment}
              >
                <Text style={{ color: "#fff", textAlign: "center" }}>Book</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteButton, { flex: 1, marginLeft: 5 }]}
                onPress={() => setShowBooking(false)}
              >
                <Text style={{ color: "#fff", textAlign: "center" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav />
    </View>
  );
}

/* -------------------- Vendor Card -------------------- */
const VendorCard = ({
  vendor,
  isFollowed,
  onFollow,
  onContact,
  onBook,
  onView,
}: {
  vendor: Vendor;
  isFollowed: boolean;
  onFollow: () => void;
  onContact?: () => void;
  onBook?: () => void;
  onView: () => void;
}) => (
  <TouchableOpacity onPress={onView} activeOpacity={0.8}>
    <View style={styles.vendorCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.vendorName}>{vendor.businessName}</Text>
        <Text style={styles.vendorDesc}>{vendor.description}</Text>
        <Text style={styles.vendorLocation}>📍 {vendor.location}</Text>
        <Text style={styles.vendorEmail}>✉️ {vendor.email}</Text>
        <Text style={styles.vendorPhone}>📞 {vendor.phoneNumber}</Text>
        <Text style={{ marginTop: 4 }}>⭐ {vendor.rating?.toFixed(1) || "0.0"}</Text>
      </View>

      <View style={{ justifyContent: "space-around", alignItems: "center" }}>
        <TouchableOpacity
          style={[styles.followBtn, { backgroundColor: isFollowed ? "#6c757d" : "#d6336c" }]}
          onPress={onFollow}
        >
          <Text style={styles.followText}>{isFollowed ? "Unfollow" : "Follow"}</Text>
        </TouchableOpacity>

        {onContact && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#25D366" }]} onPress={onContact}>
            <Text style={styles.followText}>WhatsApp</Text>
          </TouchableOpacity>
        )}

        {onBook && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#007bff" }]} onPress={onBook}>
            <Text style={styles.followText}>Book</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  </TouchableOpacity>
);

/* -------------------- Styles -------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff0f6" },
  categoryTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginVertical: 10,
  },
  categoryButton: {
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    margin: 5,
    borderWidth: 1,
    borderColor: "#d6336c",
  },
  categoryButtonActive: { backgroundColor: "#d6336c" },
  categoryText: { color: "#d6336c", fontWeight: "500" },
  categoryTextActive: { color: "#fff" },
  vendorCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    margin: 10,
    padding: 14,
    elevation: 3,
  },
  vendorName: { fontSize: 17, fontWeight: "bold", color: "#d6336c" },
  vendorDesc: { fontSize: 13, color: "#555", marginBottom: 3 },
  vendorLocation: { fontSize: 13, color: "#777" },
  vendorEmail: { fontSize: 13, color: "#777" },
  vendorPhone: { fontSize: 13, color: "#777" },
  iconBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignItems: "center" },
  followText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  modalContainer: { flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 20 },
  modalContent: { backgroundColor: "#fff", borderRadius: 10, padding: 20 },
  modalHeader: { fontSize: 18, fontWeight: "bold", marginBottom: 10, textAlign: "center" },
  dateButton: { backgroundColor: "#f1f1f1", borderRadius: 8, padding: 12, marginVertical: 10 },
  dateText: { textAlign: "center", color: "#333" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10, marginVertical: 10 },
  modalButtons: { flexDirection: "row", marginTop: 10 },
  addButtonTop: { backgroundColor: "#007bff", borderRadius: 8, paddingVertical: 10 },
  deleteButton: { backgroundColor: "#dc3545", borderRadius: 8, paddingVertical: 10 },
  followBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 6,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 6,
  },
});
