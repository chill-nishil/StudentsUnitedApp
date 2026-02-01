// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBHAbddLn466GXwnJWyU22MZxrykFjYLHI",
  authDomain: "studentsunitedchat.firebaseapp.com",
  projectId: "studentsunitedchat",
  storageBucket: "studentsunitedchat.firebasestorage.app",
  messagingSenderId: "41408019393",
  appId: "1:41408019393:web:e62fc5346cd342def48d40"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app);
export { db };

