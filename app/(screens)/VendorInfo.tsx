import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "../../firebaseConfig";

const firestore = getFirestore(app);

export default function VendorPage() {
  const { id } = useLocalSearchParams();
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVendor = async () => {
      try {
        const docRef = doc(firestore, "vendors", id as string);
        const vendorSnap = await getDoc(docRef);
        if (vendorSnap.exists()) {
          setVendor(vendorSnap.data());
        } else {
          console.warn("Vendor not found");
        }
      } catch (err) {
        console.error("Error fetching vendor:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchVendor();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d6336c" />
      </View>
    );
  }

  if (!vendor) {
    return (
      <View style={styles.errorContainer}>
        <Text style={{ color: "#555", fontSize: 16 }}>Vendor not found.</Text>
      </View>
    );
  }

  const openWhatsApp = () => {
    const phoneNumber = vendor.phone.replace(/\D/g, "");
    const message = encodeURIComponent(`Hi ${vendor.name}, I’m interested in your services!`);
    Linking.openURL(`https://wa.me/${phoneNumber}?text=${message}`);
  };

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: vendor.image }} style={styles.image} />

      <View style={styles.detailsContainer}>
        <Text style={styles.name}>{vendor.name}</Text>
        <Text style={styles.category}>{vendor.category}</Text>

        <Text style={styles.sectionHeader}>About</Text>
        <Text style={styles.description}>{vendor.description || "No description available."}</Text>

        {vendor.location && (
          <>
            <Text style={styles.sectionHeader}>Location</Text>
            <Text style={styles.info}>{vendor.location}</Text>
          </>
        )}

        <Text style={styles.sectionHeader}>Contact</Text>
        <Text style={styles.info}>Phone: {vendor.phone}</Text>

        <TouchableOpacity style={styles.whatsappButton} onPress={openWhatsApp}>
          <Text style={styles.whatsappText}>💬 Chat on WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff0f6",
  },
  image: {
    width: "100%",
    height: 250,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  detailsContainer: {
    padding: 20,
  },
  name: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#d6336c",
    marginBottom: 5,
  },
  category: {
    fontSize: 16,
    color: "#888",
    marginBottom: 15,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#d6336c",
    marginTop: 15,
    marginBottom: 5,
  },
  description: {
    fontSize: 15,
    color: "#444",
    lineHeight: 22,
  },
  info: {
    fontSize: 15,
    color: "#555",
  },
  whatsappButton: {
    backgroundColor: "#25D366",
    borderRadius: 25,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  whatsappText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff0f6",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff0f6",
  },
});
