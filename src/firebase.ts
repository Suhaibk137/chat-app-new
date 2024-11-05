// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCqCN1JVG8xVcPq6_7Zrn82pg1iqeCsQBI",
  authDomain: "chat-app-848a6.firebaseapp.com",
  projectId: "chat-app-848a6",
  storageBucket: "chat-app-848a6.firebasestorage.app",
  messagingSenderId: "31591402155",
  appId: "1:31591402155:web:c131f1eded2eb3959cc786"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);