// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCuB5RPN7-Le8EGQx_VqtH7wUwFWZpmHYQ",
  authDomain: "twiller-4fa04.firebaseapp.com",
  projectId: "twiller-4fa04",
  storageBucket: "twiller-4fa04.firebasestorage.app",
  messagingSenderId: "133675264767",
  appId: "1:133675264767:web:bf8d9271a2abf86553baca",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export default app;
