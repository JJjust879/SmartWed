// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAnFi4kIUZFq5AzK3sEWLjREE5bEMx2Jls",
  authDomain: "smartwed-jj777.firebaseapp.com",
  projectId: "smartwed-jj777",
  storageBucket: "smartwed-jj777.firebasestorage.app",
  messagingSenderId: "558059387787",
  appId: "1:558059387787:android:fa21cd606660d2d8d60d8e"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);

export { app, auth, firestore, storage, firebaseConfig };
