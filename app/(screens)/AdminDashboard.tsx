import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Switch,
  StyleSheet,
  Image,
  Linking,
} from "react-native";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { firestore } from "../../firebaseConfig";
import { useRouter } from "expo-router";

export default function AdminDashboard() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(firestore, "vendors"));
      const vendorList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setVendors(vendorList);
    } catch (err) {
      console.error("Error loading vendors:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleApproval = async (vendorId: string, currentStatus: any) => {
    try {
      setUpdating(true);
      
      const newStatus = currentStatus === true || currentStatus === "Yes"; 
      // Flip boolean
      const newApprovedValue = !newStatus; 

      await updateDoc(doc(firestore, "vendors", vendorId), {
        approved: newApprovedValue,
      });

      setSelectedVendor((prev: any) => ({
        ...prev,
        approved: newApprovedValue,
      }));

      await fetchVendors();
    } catch (err) {
      console.error("Error updating approval:", err);
    } finally {
      setUpdating(false);
    }
  };

  const renderVendorItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.vendorItem}
      onPress={() => {
        setSelectedVendor(item);
        setModalVisible(true);
      }}
    >
      <Text style={styles.vendorName}>{item.businessName || "Unnamed Vendor"}</Text>
      <Text
        style={[
          styles.status,
          { color: item.approved ? "green" : "red" }
        ]}
      >
        {item.approved ? "Approved" : "Pending"}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#d6336c" />
        <Text>Loading vendors...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>👑 Admin Dashboard</Text>

      {/* Exit / Back button */}
      <TouchableOpacity
        style={styles.exitButton}
        onPress={() => router.replace("/LandingPage")}
      >
        <Text style={styles.exitText}>⬅ Back to Landing Page</Text>
      </TouchableOpacity>

      <FlatList
        data={vendors}
        keyExtractor={(item) => item.id}
        renderItem={renderVendorItem}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Vendor Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            {selectedVendor ? (
              <>
                <Text style={styles.modalTitle}>
                  {selectedVendor.businessName || "Vendor Details"}
                </Text>
                <Text>📞 Phone: {selectedVendor.phoneNumber}</Text>
                <Text>👤 Owner: {selectedVendor.businessName}</Text>
                <Text>🏷️ Category: {selectedVendor.category}</Text>
                <Text>✅ Approved: {selectedVendor.approved}</Text>

                {/* Proof of Business */}
                {selectedVendor.proofOfBusiness ? (
                  <View style={{ marginTop: 15 }}>
                    <Text style={{ fontWeight: "bold" }}>📄 Proof of Business:</Text>
                    {selectedVendor.proofOfBusiness.match(/\.(jpg|jpeg|png)$/i) ? (
                      <Image
                        source={{ uri: selectedVendor.proofOfBusiness }}
                        style={styles.proofImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(selectedVendor.proofOfBusiness)}
                      >
                        <Text style={{ color: "#1e88e5", marginTop: 5 }}>
                          Open File
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <Text style={{ marginTop: 15, color: "#777" }}>
                    No proof uploaded
                  </Text>
                )}

                <View style={styles.toggleContainer}>
                  <Text style={{ fontWeight: "bold", marginRight: 10 }}>
                    Toggle Approval:
                  </Text>
                  <Switch
                    value={!!selectedVendor.approved}
                    onValueChange={() =>
                      toggleApproval(selectedVendor.id, selectedVendor.approved)
                    }
                    disabled={updating}
                  />
                </View>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ActivityIndicator size="large" color="#d6336c" />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff0f6", padding: 20 },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#d6336c",
    marginBottom: 10,
    textAlign: "center",
  },
  exitButton: {
    backgroundColor: "#fff",
    borderColor: "#d6336c",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 15,
    alignSelf: "center",
    marginBottom: 10,
  },
  exitText: { color: "#d6336c", fontWeight: "bold" },
  vendorItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  vendorName: { fontSize: 16, fontWeight: "600", color: "#333" },
  status: { fontSize: 14, fontWeight: "500" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    width: "85%",
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#d6336c",
    marginBottom: 10,
  },
  proofImage: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    marginTop: 5,
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },
  closeButton: {
    backgroundColor: "#d6336c",
    marginTop: 20,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  closeText: { color: "#fff", fontWeight: "bold" },
});
