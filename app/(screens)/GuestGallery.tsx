import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableWithoutFeedback,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { firestore, storage } from "../../firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "expo-router";

interface PhotoItem {
  id: string;
  imageUrl: string;
  userId: string;
  uploadedAt: string;
  likes?: number;
  status?: string;
}

export default function GuestGallery() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [guestUid, setGuestUid] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewImage, setViewImage] = useState<PhotoItem | null>(null);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [likedPhotos, setLikedPhotos] = useState<{ [key: string]: boolean }>({});

  const router = useRouter();
  const photosRef = collection(firestore, "photos");

  // 🔹 Subscribe to photos
  const subscribeToPhotos = (uid: string) => {
    setLoading(true);
    const q = query(
      photosRef,
      where("userId", "==", uid),
      where("status", "==", "approved")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setPhotos(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PhotoItem[]
      );
      setLoading(false);
    });

    return unsub;
  };

  useEffect(() => {
    (async () => {
      const savedUid = await AsyncStorage.getItem("@guest_uid");
      const savedName = await AsyncStorage.getItem("@guest_name");
      if (!savedUid || !savedName)
        return Alert.alert("Invalid access. Please go back.");
      setGuestUid(savedUid);
      setGuestName(savedName);
      const unsub = subscribeToPhotos(savedUid);
      return () => unsub();
    })();
  }, []);

  // 🔹 Like/unlike photo safely (no spam or negative)
  const toggleLike = async (photoId: string) => {
    if (!guestUid) return;

    const likeRef = doc(firestore, `photos/${photoId}/likes/${guestUid}`);
    const photoRef = doc(firestore, "photos", photoId);
    const likeSnap = await getDoc(likeRef);
    const photoSnap = await getDoc(photoRef);

    const currentLikes = (photoSnap.data()?.likes || 0) as number;

    if (likeSnap.exists() && likeSnap.data().liked) {
      // unlike (only if likes > 0)
      await updateDoc(photoRef, {
        likes: currentLikes > 0 ? increment(-1) : 0,
      });
      await setDoc(likeRef, { liked: false });
      setLikedPhotos((prev) => ({ ...prev, [photoId]: false }));
    } else {
      // like
      await updateDoc(photoRef, { likes: increment(1) });
      await setDoc(likeRef, { liked: true });
      setLikedPhotos((prev) => ({ ...prev, [photoId]: true }));
    }
  };

  // 🔹 Load comments for a photo
  const loadComments = (photo: PhotoItem) => {
    setCommentsLoading(true);
    const commentsRef = collection(firestore, `photos/${photo.id}/comments`);
    return onSnapshot(commentsRef, (snapshot) => {
      setComments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCommentsLoading(false);
    });
  };

  // 🔹 Add comment (with guest name)
  const addComment = async () => {
    if (!commentText.trim() || !viewImage || !guestUid || !guestName) return;

    const commentRef = collection(firestore, `photos/${viewImage.id}/comments`);
    await addDoc(commentRef, {
      userId: guestUid,
      name: guestName,
      comment: commentText.trim(),
      createdAt: new Date().toISOString(),
    });

    setCommentText("");
    loadComments(viewImage);
  };

  // 🔹 Pick image and upload
  const pickImage = async () => {
    if (!guestUid) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Grant gallery access.");

    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!r.canceled && r.assets[0]) uploadImage(r.assets[0].uri);
  };

  const uploadImage = async (uri: string) => {
    if (!guestUid) return;
    try {
      setUploading(true);
      const blob = await (await fetch(uri)).blob();
      const filename = `photo_${Date.now()}.jpg`;
      const storageRef = ref(storage, `photos/${guestUid}/${filename}`);

      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      await addDoc(photosRef, {
        imageUrl: url,
        userId: guestUid,
        uploadedAt: new Date().toISOString(),
        likes: 0,
        status: "pending",
      });

      Alert.alert("Uploaded", "Photo uploaded as pending approval ✅");
    } catch (e) {
      Alert.alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // 🔹 Render each photo
  const renderPhoto = ({ item }: { item: PhotoItem }) => {
  const isLiked = likedPhotos[item.id] || false;

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        setViewImage(item);
        loadComments(item);
      }}
    >
      <View style={styles.photoCard}>
        <Image source={{ uri: item.imageUrl }} style={styles.photo} />
        <View style={styles.photoFooter}>
          <TouchableOpacity onPress={() => toggleLike(item.id)}>
            <Text
              style={[
                styles.likeText,
                { color: isLiked ? "#ff4d6d" : "#ffffff" }, 
              ]}
            >
              ❤️ {item.likes || 0}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

  const exitGallery = async () => {
    await AsyncStorage.removeItem("@guest_uid");
    await AsyncStorage.removeItem("@guest_name");
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Guest Gallery</Text>
        <TouchableOpacity style={styles.exitBtn} onPress={exitGallery}>
          <Ionicons name="exit-outline" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#d6336c" />
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(i) => i.id}
          renderItem={renderPhoto}
          numColumns={2}
        />
      )}

      {/* Full screen image modal */}
      <Modal visible={!!viewImage} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {viewImage && (
            <>
              <Image
                source={{ uri: viewImage.imageUrl }}
                style={styles.fullImage}
              />
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => {
                  setViewImage(null);
                  setComments([]);
                }}
              >
                <Ionicons name="close" size={30} color="#fff" />
              </TouchableOpacity>

              <View style={styles.commentBox}>
                <TextInput
                  style={styles.input}
                  placeholder="Add a comment..."
                  value={commentText}
                  onChangeText={setCommentText}
                />
                <TouchableOpacity onPress={addComment}>
                  <Ionicons name="send" size={22} color="#d6336c" />
                </TouchableOpacity>
              </View>

              <View style={styles.commentList}>
                {commentsLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  comments.map((c) => (
                    <Text key={c.id} style={styles.commentText}>
                      <Text style={{ fontWeight: "bold", color: "#d6336c" }}>
                        {c.name || "Guest"}:
                      </Text>{" "}
                      {c.comment}
                    </Text>
                  ))
                )}
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Upload FAB */}
      <TouchableOpacity style={styles.fab} onPress={pickImage}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Uploading modal */}
      <Modal visible={uploading} transparent>
        <View style={styles.modalOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: "#d6336c",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  exitBtn: { padding: 5, borderRadius: 8 },
  photoCard: { flex: 1, margin: 5, borderRadius: 10, overflow: "hidden" },
  photo: { width: "100%", height: 180 },
  likeText: { fontSize: 14, color: "#d6336c" },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.9)",
  },
  fullImage: { width: "100%", height: "55%", resizeMode: "contain" },
  closeBtn: { position: "absolute", top: 50, right: 25 },
  commentBox: { flexDirection: "row", padding: 10, backgroundColor: "#fff" },
  input: {
    flex: 1,
    marginRight: 10,
    borderBottomColor: "#aaa",
    borderBottomWidth: 1,
    paddingVertical: 5,
  },
  commentList: { maxHeight: "30%", padding: 10 },
  commentText: { color: "#fff", marginVertical: 3 },
  fab: {
    position: "absolute",
    bottom: 50,
    right: 25,
    backgroundColor: "#d6336c",
    padding: 14,
    borderRadius: 28,
  },
  photoFooter: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingHorizontal: 8,
  paddingVertical: 6,
  backgroundColor: "#00000099",
  position: "absolute",
  bottom: 0,
  width: "100%",
},
likeIcon: {
  marginRight: 5,
},
likeCount: {
  color: "#fff",
  fontWeight: "600",
},

});
