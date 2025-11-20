// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // <--- NUEVO

const firebaseConfig = {
  apiKey: "AIzaSyC5-yUufvrb539FhoBr49jP0fapjInKPt8",
  authDomain: "huellaescolar-8b28f.firebaseapp.com",
  projectId: "huellaescolar-8b28f",
  storageBucket: "huellaescolar-8b28f.firebasestorage.app",
  messagingSenderId: "815506791820",
  appId: "1:815506791820:web:84d90bf808f7606a86caa9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app); // <--- NUEVO
const googleProvider = new GoogleAuthProvider(); // <--- NUEVO

export { db, storage, auth, googleProvider };