/**
 * Firebase Configuration and Initialization
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB0E0XwpRHonkuMBhrxfbtu1TxybWNPoUk",
  authDomain: "vitatrack-dd082.firebaseapp.com",
  projectId: "vitatrack-dd082",
  storageBucket: "vitatrack-dd082.firebasestorage.app",
  messagingSenderId: "845683928330",
  appId: "1:845683928330:web:4da6101bf88be3e23f1ef3",
  measurementId: "G-4T6RVQZHHE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
