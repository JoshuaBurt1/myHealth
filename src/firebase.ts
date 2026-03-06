import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
    apiKey: 'AIzaSyB1jhXYM_1nkOpvkhokcik9_zYSrSenRRM',
    appId: '1:702841156351:web:b105027698de92b56d52ca',
    messagingSenderId: '702841156351',
    projectId: 'squarehexagon-holdings',
    authDomain: 'squarehexagon-holdings.firebaseapp.com',
    storageBucket: 'squarehexagon-holdings.firebasestorage.app',
    measurementId: 'G-QV7Q6LZZHJ'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services to be used across your React components
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;