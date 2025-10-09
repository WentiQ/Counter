// firebase-config.js
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Firebase configuration
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
firebase.initializeApp(firebaseConfig);

// Get Firebase services
export const auth = firebase.auth();
export const db = firebase.firestore();
export const googleProvider = new firebase.auth.GoogleAuthProvider();

// --- Custom Configuration ---
export const DEFAULT_TEMPLE_ID = 'MAIN_BRANCH';
export const DEFAULT_TEMPLE_NAME = 'Main Temple Branch (Default)';

/** * CRITICAL SECURITY NOTE: 
 * For a client-side application, this key acts as a pre-shared administrative token.
 * CHANGE THIS TO A UNIQUE, COMPLEX STRING IMMEDIATELY. 
 * Any user who knows this key can register as an Authority.
 */
export const AUTHORITY_SECRET_KEY = 'ADMIN'; 
