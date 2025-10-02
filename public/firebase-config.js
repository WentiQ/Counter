// firebase-config.js

// Import the functions you need from the Firebase SDKs
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration (REPLACE WITH YOUR ACTUAL CONFIG)
const firebaseConfig = {
  apiKey: "AIzaSyA-MxIzgGcWfkyVhU6weQ90FdQBYKAwMDM",
  authDomain: "prasadam-counter.firebaseapp.com",
  databaseURL: "https://prasadam-counter-default-rtdb.firebaseio.com",
  projectId: "prasadam-counter",
  storageBucket: "prasadam-counter.appspot.com",
  messagingSenderId: "770901647160",
  appId: "1:770901647160:web:1ae3097119caa3fb3cabcd",
  measurementId: "G-M4RMCXENR0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// --- Custom Configuration ---
export const DEFAULT_TEMPLE_ID = 'MAIN_BRANCH';
export const DEFAULT_TEMPLE_NAME = 'Main Temple Branch (Default)';

/** * CRITICAL SECURITY NOTE: 
 * For a client-side application, this key acts as a pre-shared administrative token.
 * CHANGE THIS TO A UNIQUE, COMPLEX STRING IMMEDIATELY. 
 * Any user who knows this key can register as an Authority.
 */
export const AUTHORITY_SECRET_KEY = 'PRASAD_ADMIN_2024_CHANGE_ME_NOW'; 
