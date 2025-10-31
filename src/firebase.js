import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAtNlA3ZKz2ie8asSzvBGc3pIES-h0soCs",
  authDomain: "app1-f2a63.firebaseapp.com",
  databaseURL: "https://app1-f2a63-default-rtdb.firebaseio.com",
  projectId: "app1-f2a63",
  storageBucket: "app1-f2a63.firebasestorage.app",
  messagingSenderId: "188031947685",
  appId: "1:188031947685:web:ebe8daa67211f4c4174e4c",
  measurementId: "G-W9X8ZHYEQ3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app); // Realtime Database for presence/typing indicators
const storage = getStorage(app);

export { auth, db, rtdb, storage };
