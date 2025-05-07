import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyDDhz6UJkTwJ3fmNPTqCOGc7oljW-To52U",
  authDomain: "employee-kpi-system.firebaseapp.com",
  projectId: "employee-kpi-system",
  storageBucket: "employee-kpi-system.firebasestorage.app",
  messagingSenderId: "204573122017",
  appId: "1:204573122017:web:6bd8fe642bd087cf3646a0",
  measurementId: "G-SYYET8MGVP"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export { app, auth, firestore, storage, analytics, signInWithEmailAndPassword }; 