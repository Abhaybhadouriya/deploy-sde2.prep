import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAaojj5u32q2KfmzLJGmh8mog1jOLsbUXI",
  authDomain:  "devtubein.firebaseapp.com",
  databaseURL: "https://devtubein-default-rtdb.firebaseio.com",
  projectId: "devtubein",
  storageBucket: "devtubein.appspot.com",
  messagingSenderId: "420262695468",
  appId: "1:420262695468:web:9d6b8016de662dec7d3789",
  measurementId: "G-L7RXR2382E"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
