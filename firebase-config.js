// firebase-config.js
// Replace values only if different; this is your current project config.
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

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Expose commonly used services
window.db = firebase.database();
window.auth = firebase.auth();
window.GoogleAuthProvider = firebase.auth.GoogleAuthProvider;
