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
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  orderBy,
} from "firebase/firestore";
import { firestore, storage, auth } from "../../firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import BottomNav from "../components/BottomNav";
import * as Clipboard from "expo-clipboard";

interface PhotoItem {
  id: string;
  imageUrl: string;
  userId: string;
  uploadedAt: string;
  likes?: number;
  status?: string;
}

export default function PhotoGalleryPage() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewImage, setViewImage] = useState<PhotoItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [tab, setTab] = useState<"approved" | "pending">("approved");
  const [confirmDelete, setConfirmDelete] = useState<PhotoItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [likedPhotos, setLikedPhotos] = useState<{ [key: string]: boolean }>({});
  const [likeInProgress, setLikeInProgress] = useState<string | null>(null);

  const photosRef = collection(firestore, "photos");
  let unsubscribePhotos: any = null;

  useEffect(() => {
    (async () => {
      const savedUid = await AsyncStorage.getItem("@uid");
      if (!savedUid) return Alert.alert("Log in again.");
      setUserId(savedUid);
      subscribeToPhotos(savedUid);
    })();
  }, []);

  useEffect(() => {
    if (userId) subscribeToPhotos(userId);
  }, [tab]);

  const subscribeToPhotos = (uid: string) => {
    setLoading(true);
    const q = query(
      photosRef,
      where("userId", "==", uid),
      where("status", "==", tab),
      orderBy("uploadedAt", "desc")
    );

    if (unsubscribePhotos) unsubscribePhotos();
    unsubscribePhotos = onSnapshot(q, async (snapshot) => {
      const newPhotos = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as PhotoItem[];

      setPhotos(newPhotos);
      setLoading(false);

      // Check likes in parallel
      const likeStates: { [key: string]: boolean } = {};
      await Promise.all(
        newPhotos.map(async (photo) => {
          const likeRef = doc(firestore, `photos/${photo.id}/likes/${uid}`);
          const likeDoc = await getDoc(likeRef);
          likeStates[photo.id] = likeDoc.exists();
        })
      );
      setLikedPhotos(likeStates);
    });
  };

  // LIKE photo - safe toggle (non spammable)
  const toggleLike = async (photoId: string) => {
    if (!userId || likeInProgress === photoId) return;
    setLikeInProgress(photoId);

    const likeRef = doc(firestore, `photos/${photoId}/likes/${userId}`);
    const photoRef = doc(firestore, "photos", photoId);

    try {
      const likeDoc = await getDoc(likeRef);
      if (likeDoc.exists()) {
        // Unlike
        await deleteDoc(likeRef);
        await updateDoc(photoRef, { likes: increment(-1) });
        setLikedPhotos((prev) => ({ ...prev, [photoId]: false }));
      } else {
        // Like
        await setDoc(likeRef, { userId, likedAt: new Date().toISOString() });
        await updateDoc(photoRef, { likes: increment(1) });
        setLikedPhotos((prev) => ({ ...prev, [photoId]: true }));
      }
    } catch (err) {
      console.log("Error toggling like:", err);
    } finally {
      setLikeInProgress(null);
    }
  };

  // COMMENTS
  const loadComments = (photo: PhotoItem) => {
    setCommentsLoading(true);
    const commentsRef = collection(firestore, `photos/${photo.id}/comments`);
    return onSnapshot(
      query(commentsRef, orderBy("createdAt", "asc")),
      (snapshot) => {
        setComments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCommentsLoading(false);
      }
    );
  };

  const addComment = async () => {
  if (!commentText.trim() || !viewImage) return;

  try {
    const user = auth.currentUser;
    const name = user?.displayName || user?.phoneNumber || "Anonymous";

    const commentData = {
      name,
      comment: commentText.trim(),
      createdAt: new Date(),
    };

    const commentRef = collection(firestore, "photos", viewImage.id, "comments");
    await addDoc(commentRef, commentData);

    setCommentText("");
    if (viewImage) loadComments(viewImage);
  } catch (error) {
    console.error("Error adding comment:", error);
  }
};

  // UPLOAD
  const pickImage = async () => {
    if (!userId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Grant gallery access.");

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) uploadImage(result.assets[0].uri);
  };

  const uploadImage = async (uri: string) => {
    if (!userId) return;
    try {
      setUploading(true);
      const blob = await (await fetch(uri)).blob();
      const filename = `photo_${Date.now()}.jpg`;
      const storageRef = ref(storage, `photos/${userId}/${filename}`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      const status = tab === "pending" ? "pending" : "approved";

      await addDoc(photosRef, {
        imageUrl: url,
        userId,
        uploadedAt: new Date().toISOString(),
        likes: 0,
        status,
      });
      Alert.alert("Uploaded", `Photo uploaded as ${status}`);
    } catch {
      Alert.alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // APPROVE
  const approvePhoto = async (photoId: string) => {
    try {
      await updateDoc(doc(firestore, "photos", photoId), { status: "approved" });
      Alert.alert("Photo approved");
    } catch {
      Alert.alert("Approval failed");
    }
  };

  // DELETE
  const deletePhoto = async () => {
    if (!confirmDelete) return;
    try {
      setDeleteLoading(true);
      await deleteDoc(doc(firestore, "photos", confirmDelete.id));
      setConfirmDelete(null);
      setViewImage(null);
    } catch {
      Alert.alert("Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  };

  const shareUID = async () => {
    if (!userId) return;
    await Clipboard.setStringAsync(userId);
    Alert.alert("UID Copied", "Your UID is copied");
  };

  const renderPhoto = ({ item }: { item: PhotoItem }) => {
    const isLiked = likedPhotos[item.id];
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
            <TouchableOpacity onPress={() => toggleLike(item.id)} disabled={likeInProgress === item.id}>
              <Text style={[styles.likeText, isLiked && { color: "#ff3366" }]}>
                {isLiked ? "❤️" : "🤍"} {item.likes || 0}
              </Text>
            </TouchableOpacity>
            <Ionicons name="chatbubble-outline" size={18} color="#555" />
            {tab === "pending" && (
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => approvePhoto(item.id)}
              >
                <Text style={styles.approveText}>Approve</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Photo Gallery</Text>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, tab === "approved" && styles.activeTab]}
          onPress={() => setTab("approved")}
        >
          <Text style={[styles.tabText, tab === "approved" && styles.activeTabText]}>
            Public
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "pending" && styles.activeTab]}
          onPress={() => setTab("pending")}
        >
          <Text style={[styles.tabText, tab === "pending" && styles.activeTabText]}>
            Pending
          </Text>
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
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {/* Image Modal */}
      <Modal visible={!!viewImage} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        {viewImage && (
          <>
            {/* Full image view */}
            <Image source={{ uri: viewImage.imageUrl }} style={styles.fullImage} />

            {/* Close button */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                setViewImage(null);
                setComments([]);
              }}
            >
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>

            {/* Delete button */}
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => setConfirmDelete(viewImage)}
            >
              <Ionicons name="trash-outline" size={26} color="#fff" />
            </TouchableOpacity>

            {/* Comment input box */}
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

            {/* Comment list */}
            <View style={styles.commentList}>
              {commentsLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={{ marginBottom: 8 }}>
                    <Text
                      style={{
                        color: "#ffb6c1",
                        fontWeight: "bold",
                        marginBottom: 2,
                      }}
                    >
                      {c.name || "Anonymous"}:
                    </Text>
                    <Text style={styles.commentText}>{c.comment}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </View>
      </Modal>

      {/* Confirm Delete */}
      <Modal visible={!!confirmDelete} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deleteConfirmBox}>
            <Text style={styles.confirmText}>Delete this photo?</Text>
            {deleteLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.confirmActions}>
                <TouchableOpacity onPress={deletePhoto} style={styles.confirmBtn}>
                  <Text style={styles.confirmBtnText}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setConfirmDelete(null)}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelBtnText}>No</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.fab} onPress={pickImage}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.shareTopRight} onPress={shareUID}>
        <Ionicons name="share-social-outline" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={uploading} transparent>
        <View style={styles.modalOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </Modal>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  title: { textAlign: "center", color: "#d6336c", fontSize: 22, marginVertical: 10, fontWeight: "700" },
  tabContainer: { flexDirection: "row", alignSelf: "center", backgroundColor: "#eee", borderRadius: 20, marginBottom: 10 },
  tab: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  activeTab: { backgroundColor: "#d6336c" },
  tabText: { fontSize: 14, color: "#333", fontWeight: "600" },
  activeTabText: { color: "#fff" },
  photoCard: { flex: 1, margin: 5, borderRadius: 10, overflow: "hidden" },
  photo: { width: "100%", height: 180 },
  photoFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 5 },
  likeText: { fontSize: 14, color: "#d6336c" },
  approveBtn: { backgroundColor: "#28a745", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  approveText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  modalOverlay: { flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.9)" },
  fullImage: { width: "100%", height: "55%", resizeMode: "contain" },
  commentBox: { flexDirection: "row", padding: 10, backgroundColor: "#fff" },
  input: { flex: 1, marginRight: 10, borderBottomColor: "#aaa", borderBottomWidth: 1, paddingVertical: 5 },
  commentList: { maxHeight: "30%", padding: 10 },
  commentText: { color: "#fff", marginVertical: 3 },
  fab: { position: "absolute", bottom: 80, right: 25, backgroundColor: "#d6336c", padding: 14, borderRadius: 28 },
  shareTopRight: { position: "absolute", top: 25, right: 20, backgroundColor: "#d6336c", padding: 12, borderRadius: 24 },
  closeBtn: { position: "absolute", top: 40, right: 20, padding: 6, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 20 },
  deleteBtn: { position: "absolute", top: 40, left: 20, padding: 6, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 20 },
  deleteConfirmBox: { backgroundColor: "#333", padding: 20, borderRadius: 10, alignItems: "center", marginHorizontal: 30 },
  confirmText: { color: "#fff", fontSize: 16, marginBottom: 10 },
  confirmActions: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 10 },
  confirmBtn: { backgroundColor: "#d6336c", paddingVertical: 8, paddingHorizontal: 20, borderRadius: 6 },
  confirmBtnText: { color: "#fff", fontWeight: "600" },
  cancelBtn: { backgroundColor: "#555", paddingVertical: 8, paddingHorizontal: 20, borderRadius: 6 },
  cancelBtnText: { color: "#fff", fontWeight: "600" },
});
