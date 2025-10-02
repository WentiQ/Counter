// script.js

// --- 1. FIREBASE AUTH AND FIRESTORE IMPORTS (Directly from CDN) ---
import { 
    // Auth Functions
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

import { 
    // Firestore Functions
    doc, 
    getDoc, 
    onSnapshot, 
    collection, 
    writeBatch,
    runTransaction,
    query,
    getDocs
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";


// --- 2. LOCAL IMPORTS (Initialized services and constants) ---
import { 
    auth, 
    db, 
    googleProvider,
    DEFAULT_TEMPLE_ID,
    DEFAULT_TEMPLE_NAME,
    AUTHORITY_SECRET_KEY 
} from './firebase-config.js';

// Global variables for user state
let currentUserRole = null;
let currentUserTempleId = null;
let tempGoogleUser = null; // Stores the user object during multi-step registration
let currentAuthState = 'auth'; // Variable to track the user's intended role during signup

// --- Helper Functions ---

/** Shows only the relevant view and hides others. */
function showView(authView, signupOptionsView, signupFormView, servantView, authorityView, fullScreenCounterView, logoutBtn, viewId) {
    console.log('Showing view:', viewId);
    
    // First, remove full screen mode if it's active
    document.body.classList.remove('full-screen-mode');
    
    // Hide all views first
    authView.style.display = 'none';
    signupOptionsView.style.display = 'none';
    signupFormView.style.display = 'none';
    servantView.style.display = 'none';
    authorityView.style.display = 'none';
    fullScreenCounterView.style.display = 'none';
    logoutBtn.style.display = 'none';
    
    // Then show the requested view
    const targetView = document.getElementById(viewId);
    if (!targetView) {
        console.error('Target view not found:', viewId);
        return;
    }
    
    if (viewId === 'full-screen-counter-view') {
        // Special handling for full screen view
        targetView.style.display = 'block';
        document.body.classList.add('full-screen-mode');
        console.log('Enabled full screen mode');
    } else if (viewId === 'auth-view' || viewId === 'signup-options-view' || viewId === 'signup-form-view') {
        // Auth views
        targetView.style.display = 'block';
    } else {
        // Main application views
        targetView.style.display = 'block';
        logoutBtn.style.display = 'block';
    }
}

/** Toggles loading screen */
function setLoading(loadingOverlay, isLoading) {
    loadingOverlay.style.display = isLoading ? 'flex' : 'none';
}

/** Initializes user data in Firestore for a brand new account.
 * Assigns role and temple ID based on sign-up method.
 */
async function initializeNewUser(user, inputTempleId, role) {
    const templeId = inputTempleId || DEFAULT_TEMPLE_ID;
    const userName = user.displayName || user.email.split('@')[0];
    const uid = user.uid;

    const userDocRef = doc(db, 'users', uid);
    const countDocRef = doc(db, 'temples', templeId, 'counts', uid);
    
    const batch = writeBatch(db);

    // 1. Create User Document 
    batch.set(userDocRef, {
        email: user.email,
        name: userName,
        role: role, 
        temple_id: templeId
    });

    // 2. Create Count Document (only for servants)
    if (role === 'servant') {
        batch.set(countDocRef, {
            name: userName,
            current_count: 0,
            last_updated: new Date().toISOString()
        });
    }

    // 3. Ensure Temple Document exists
    const templeDocRef = doc(db, 'temples', templeId);
    const templeDocSnap = await getDoc(templeDocRef);
    if (!templeDocSnap.exists()) {
        // Create a default temple name if it doesn't exist
        const tName = (templeId === DEFAULT_TEMPLE_ID) ? DEFAULT_TEMPLE_NAME : `Temple ID: ${templeId}`;
        batch.set(templeDocRef, { name: tName }, { merge: true });
    }
    
    await batch.commit();
    console.log(`New user (${role}) initialized successfully in:`, templeId);
}


// --- Wait for the entire DOM to be loaded before attaching listeners ---
window.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const authView = document.getElementById('auth-view');
    const signupOptionsView = document.getElementById('signup-options-view'); 
    const signupFormView = document.getElementById('signup-form-view');     
    const servantView = document.getElementById('servant-view');
    const authorityView = document.getElementById('authority-view');
    const fullScreenCounterView = document.getElementById('full-screen-counter-view'); 
    const logoutBtn = document.getElementById('logout-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    // Auth View Buttons
    const googleLoginBtn = document.getElementById('google-login-btn');

    // Sign Up Options View Buttons
    const selectServantBtn = document.getElementById('select-servant-btn');
    const selectAuthorityBtn = document.getElementById('select-authority-btn');
    const backToAuthBtn = document.getElementById('back-to-auth-btn');

    // Sign Up Form View Inputs/Buttons
    const finalSignupBtn = document.getElementById('final-signup-btn');
    const backToOptionsBtn = document.getElementById('back-to-options-btn');
    const templeIdInput = document.getElementById('temple-id-input');
    const authorityKeyInput = document.getElementById('authority-key-input');
    const authError = document.getElementById('auth-error');
    const roleTitleDisplay = document.getElementById('role-title-display'); 
    const currentSignupEmail = document.getElementById('current-signup-email');

    // Authority Specific Field
    const authorityFields = document.getElementById('authority-fields');
    
    // Servant View Elements
    const incrementBtn = document.getElementById('increment-btn'); 
    const fullScreenToggleBtn = document.getElementById('full-screen-toggle-btn'); 
    const servantIndividualCount = document.getElementById('servant-individual-count');
    const servantTotalCount = document.getElementById('servant-total-count');
    const servantNameDisplay = document.getElementById('servant-name');
    const servantTempleName = document.getElementById('servant-temple-name');
    const servantTempleId = document.getElementById('servant-temple-id');

    // Debug log to check if elements are found
    console.log('Found increment button:', !!incrementBtn);
    console.log('Found full screen toggle button:', !!fullScreenToggleBtn);
    
    // Immediately try to add a click event to test
    if (fullScreenToggleBtn) {
        console.log('Adding click listener to full screen toggle button');
        fullScreenToggleBtn.onclick = function() {
            console.log('Button clicked (onclick)');
        };
    } else {
        console.error('Full screen toggle button not found during initialization');
    }

    // Authority View Elements
    const authorityTotalCount = document.getElementById('authority-total-count');
    const servantList = document.getElementById('servant-list');
    const resetAllBtn = document.getElementById('reset-all-btn');
    const resetMsg = document.getElementById('reset-msg');
    const templeNameDisplay = document.getElementById('temple-name');
    const authorityTempleId = document.getElementById('authority-temple-id');
    
    // Full Screen Counter Elements
    const countOneBtn = document.getElementById('count-one-btn');
    const countTwoBtn = document.getElementById('count-two-btn');
    const countFiveBtn = document.getElementById('count-five-btn');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');

    // --- View Navigation Logic ---

    function goToSignupOptions() {
        showView(authView, signupOptionsView, signupFormView, servantView, authorityView, fullScreenCounterView, logoutBtn, 'signup-options-view');
        authError.textContent = '';
    }

    function goToSignupForm(role) {
        if (!tempGoogleUser) {
            authError.textContent = "Session expired. Please sign in with Google again.";
            showView(authView, signupOptionsView, signupFormView, servantView, authorityView, fullScreenCounterView, logoutBtn, 'auth-view');
            return;
        }

        currentAuthState = role; 
        roleTitleDisplay.textContent = role.charAt(0).toUpperCase() + role.slice(1) + " Registration";
        currentSignupEmail.textContent = tempGoogleUser.email;

        if (role === 'authority') {
            authorityFields.style.display = 'block';
        } else {
            authorityFields.style.display = 'none';
        }

        showView(authView, signupOptionsView, signupFormView, servantView, authorityView, fullScreenCounterView, logoutBtn, 'signup-form-view');
        authError.textContent = ''; 
    }

    function goToServantDashboard() {
        showView(authView, signupOptionsView, signupFormView, servantView, authorityView, fullScreenCounterView, logoutBtn, 'servant-view');
    }

    // --- UI/Data Logic ---

    /** Sets up real-time listener for the servant's individual count. */
    function listenForServantCount(uid, templeId, userName) {
        const countRef = doc(db, 'temples', templeId, 'counts', uid);
        servantNameDisplay.textContent = userName;
        
        onSnapshot(countRef, (docSnap) => {
            if (docSnap.exists()) {
                const count = docSnap.data().current_count || 0;
                servantIndividualCount.textContent = count;
            } else {
                servantIndividualCount.textContent = 0;
            }
        });
    }

    /** Sets up real-time listener for ALL counts in a temple (used by both roles). */
    function listenForTempleCounts(templeId) {
        const countsRef = collection(db, 'temples', templeId, 'counts');

        onSnapshot(countsRef, (snapshot) => {
            let totalCount = 0;
            let servantHtml = '';

            snapshot.forEach((doc) => {
                const data = doc.data();
                const count = data.current_count || 0;
                totalCount += count;
                
                // For Authority view
                servantHtml += `
                    <li class="font-semibold text-gray-700">
                        <span>${data.name || 'Unknown Servant'}</span>
                        <strong>${count}</strong>
                    </li>
                `;
            });

            // Update the total count display for both roles
            servantTotalCount.textContent = totalCount;
            authorityTotalCount.textContent = totalCount;
            
            // Update the servant list for the Authority view
            if (currentUserRole === 'authority') {
                servantList.innerHTML = servantHtml || '<li>No servants found.</li>';
            }
        });
    }

    /** Fetches temple name for the dashboard and populates relevant fields. */
    async function fetchTempleInfo(templeId) {
        const templeRef = doc(db, 'temples', templeId);
        const docSnap = await getDoc(templeRef);

        let tName = 'Unknown Temple';
        if (docSnap.exists()) {
            tName = docSnap.data().name || 'Temple';
        } 
        
        // Update Servant View info
        servantTempleName.textContent = tName;
        servantTempleId.textContent = templeId;
        
        // Update Authority View info
        templeNameDisplay.textContent = tName;
        authorityTempleId.textContent = templeId;
    }

    // --- Action Handlers (Increment/Reset) ---

    /** Handles incrementing the servant's count by a specified value. */
    async function incrementCount(value) {
        if (!auth.currentUser || currentUserRole !== 'servant') return;

        const countRef = doc(db, 'temples', currentUserTempleId, 'counts', auth.currentUser.uid);
        const logsRef = collection(db, 'temples', currentUserTempleId, 'logs');
        const timestamp = new Date().toISOString();
        const servantName = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
        
        try {
            await runTransaction(db, async (transaction) => {
                const countDoc = await transaction.get(countRef);
                if (!countDoc.exists()) {
                    // Create the doc if somehow missing
                    transaction.set(countRef, { 
                        name: servantName,
                        current_count: value,
                        last_updated: timestamp
                    });
                } else {
                    const currentCount = countDoc.data().current_count || 0;
                    transaction.update(countRef, { 
                        current_count: currentCount + value,
                        last_updated: timestamp
                    });
                }

                // Add to logs collection
                const logDoc = doc(logsRef);
                transaction.set(logDoc, {
                    servantId: auth.currentUser.uid,
                    servantName: servantName,
                    count: value,
                    timestamp: timestamp
                });
            });
            console.log(`Count incremented by +${value} successfully!`);
        } catch (error) {
            console.error("Increment transaction failed: ", error);
        }
    }
    
    // --- Authentication Handlers ---
    
    googleLoginBtn.addEventListener('click', async () => {
        authError.textContent = '';
        setLoading(loadingOverlay, true);
        
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            
            // Check if user data already exists in Firestore
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                // Existing user: onAuthStateChanged will handle the final view display
                console.log("Existing user logged in.");
            } else {
                // New user: Store credentials and redirect to role selection
                tempGoogleUser = user;
                goToSignupOptions();
            }
        } catch (error) {
            authError.textContent = `Google Sign In failed: ${error.message}`;
            console.error("Google Sign In Error:", error);
        } finally {
            setLoading(loadingOverlay, false);
        }
    });

    // Sign Up Options View listeners
    backToAuthBtn.addEventListener('click', () => {
        tempGoogleUser = null;
        showView(authView, signupOptionsView, signupFormView, servantView, authorityView, fullScreenCounterView, logoutBtn, 'auth-view');
    });
    selectServantBtn.addEventListener('click', () => goToSignupForm('servant'));
    selectAuthorityBtn.addEventListener('click', () => goToSignupForm('authority'));

    // Sign Up Form View listeners
    backToOptionsBtn.addEventListener('click', goToSignupOptions);

    finalSignupBtn.addEventListener('click', async () => {
        console.log("Attempting final registration..."); 
        authError.textContent = '';
        const user = tempGoogleUser;
        const templeId = templeIdInput.value.trim().toUpperCase();
        const roleToAssign = currentAuthState;

        if (!user) {
            authError.textContent = 'Session expired. Please sign in again.';
            console.error("Validation failed: No user session.");
            return;
        }
        
        if (!templeId) {
            authError.textContent = 'Please enter a Temple ID.';
            console.error("Validation failed: Temple ID is empty.");
            return;
        }

        if (roleToAssign === 'authority') {
            const secretKey = authorityKeyInput.value.trim();
            if (secretKey !== AUTHORITY_SECRET_KEY) {
                authError.textContent = 'Invalid Authority Secret Key.';
                console.error(`Validation failed: Invalid secret key entered. Expected: ${AUTHORITY_SECRET_KEY}`);
                return;
            }
        }
        
        setLoading(loadingOverlay, true);
        try {
            // Finalize registration by writing user data to Firestore
            await initializeNewUser(user, templeId, roleToAssign); 
            tempGoogleUser = null; // Clear temp state
            
            // The onAuthStateChanged listener will automatically pick up the new user doc and redirect to the dashboard
        } catch (error) {
            authError.textContent = `Registration failed: ${error.message}`;
            console.error("Registration Error:", error);
        } finally {
             setLoading(loadingOverlay, false);
        }
    });


    logoutBtn.addEventListener('click', () => {
        signOut(auth);
    });

    // --- Action Handlers (Dashboard & Full Screen Counter) ---

    // Dashboard +1 button (standard counter)
    incrementBtn.addEventListener('click', () => incrementCount(1));
    
    // Toggle Full Screen View - Using both onclick and addEventListener for redundancy
    function handleFullScreenToggle() {
        console.log('Full screen toggle button clicked');
        console.log('Current user role:', currentUserRole);
        
        if (currentUserRole !== 'servant') {
            console.error('Not showing full screen view - user is not a servant');
            return;
        }
        
        const fullScreenView = document.getElementById('full-screen-counter-view');
        if (!fullScreenView) {
            console.error('Full screen view element not found');
            return;
        }
        
        // Show the full screen view
        servantView.style.display = 'none';
        fullScreenView.style.display = 'block';
        document.body.classList.add('full-screen-mode');
        
        console.log('Full screen view displayed');
    }

    if (fullScreenToggleBtn) {
        console.log('Setting up full screen toggle button handlers');
        fullScreenToggleBtn.onclick = handleFullScreenToggle;
        fullScreenToggleBtn.addEventListener('click', handleFullScreenToggle);
    } else {
        console.error('Full screen toggle button not found when setting up handlers');
    }

    // Full Screen Counter Buttons
    countOneBtn.addEventListener('click', () => incrementCount(1));
    countTwoBtn.addEventListener('click', () => incrementCount(2));
    countFiveBtn.addEventListener('click', () => incrementCount(5));

    // Exit Full Screen View
    backToDashboardBtn.addEventListener('click', goToServantDashboard);


    /** Authority action: Resets all servant counts in the temple. */
    resetAllBtn.addEventListener('click', async () => {
        if (!auth.currentUser || currentUserRole !== 'authority') return;

        // Use window.prompt for a simple confirmation (cannot use alert/confirm)
        const confirmation = window.prompt(`Type 'RESET' to confirm resetting ALL counts for temple ${currentUserTempleId}:`);
        if (confirmation !== 'RESET') {
            resetMsg.textContent = 'Reset cancelled.';
            setTimeout(() => resetMsg.textContent = '', 2000);
            return;
        }

        resetMsg.textContent = 'Resetting...';
        
        try {
            const countsRef = collection(db, 'temples', currentUserTempleId, 'counts');
            const q = query(countsRef);
            const snapshot = await getDocs(q); 

            if (snapshot.empty) {
                resetMsg.textContent = 'No counts to reset.';
                setTimeout(() => resetMsg.textContent = '', 2000);
                return;
            }

            const batch = writeBatch(db);

            snapshot.forEach((docSnap) => {
                const countDocRef = doc(db, 'temples', currentUserTempleId, 'counts', docSnap.id);
                batch.update(countDocRef, { 
                    current_count: 0,
                    last_reset_by: auth.currentUser.email,
                    last_updated: new Date().toISOString()
                });
            });

            await batch.commit();
            resetMsg.textContent = 'All counts successfully reset to 0.';
            setTimeout(() => resetMsg.textContent = '', 3000); 

        } catch (error) {
            console.error("Batch reset failed: ", error);
            resetMsg.textContent = `Reset failed: ${error.message}.`;
            setTimeout(() => resetMsg.textContent = '', 5000);
        }
    });

    // --- Main Authentication State Listener ---

    onAuthStateChanged(auth, async (user) => {
        setLoading(loadingOverlay, true);
        
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            try {
                const userDoc = await getDoc(userDocRef);
                
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    currentUserRole = data.role;
                    currentUserTempleId = data.temple_id;
                    const userName = data.name || user.displayName || user.email;
                    
                    // Check if we're returning from calendar view
                    const lastUserRole = sessionStorage.getItem('lastUserRole');
                    if (lastUserRole) {
                        sessionStorage.removeItem('lastUserRole');
                        if (lastUserRole === 'servant') {
                            showView(authView, signupOptionsView, signupFormView, servantView, authorityView, fullScreenCounterView, logoutBtn, 'servant-view');
                        } else if (lastUserRole === 'authority') {
                            showView(authView, signupOptionsView, signupFormView, servantView, authorityView, fullScreenCounterView, logoutBtn, 'authority-view');
                        }
                    }

                    if (currentUserTempleId) {
                        await fetchTempleInfo(currentUserTempleId);
                        listenForTempleCounts(currentUserTempleId);
                        
                        if (currentUserRole === 'servant') {
                            showView(authView, signupOptionsView, signupFormView, servantView, authorityView, fullScreenCounterView, logoutBtn, 'servant-view');
                            listenForServantCount(user.uid, currentUserTempleId, userName);
                        } else if (currentUserRole === 'authority') {
                            showView(authView, signupOptionsView, signupFormView, servantView, authorityView, fullScreenCounterView, logoutBtn, 'authority-view');
                        } else {
                            // Fallback if role exists but is invalid
                            showView(authView, signupOptionsView, signupFormView, servantView, authorityView, fullScreenCounterView, logoutBtn, 'auth-view');
                            authError.textContent = 'User role not recognized. Contact admin.';
                        }
                    } else {
                        // Fallback if user exists but temple_id is missing
                        showView(authView, signupOptionsView, signupFormView, servantView, authorityView, fullScreenCounterView, logoutBtn, 'auth-view');
                        authError.textContent = 'Error: User is not assigned to a temple.';
                    }
                } else {
                    // User is authenticated via Google, but has no Firestore profile.
                    // New User flow: redirect to role selection if they haven't completed it.
                    if (tempGoogleUser && tempGoogleUser.uid === user.uid) {
                         goToSignupOptions();
                    } else {
                        // User somehow missed the flow, ensure they see the sign-in page.
                        showView(authView, signupOptionsView, signupFormView, servantView, authorityView, fullScreenCounterView, logoutBtn, 'auth-view');
                    }
                }

            } catch (error) {
                console.error("Error fetching user role:", error);
                showView(authView, signupOptionsView, signupFormView, servantView, authorityView, fullScreenCounterView, logoutBtn, 'auth-view');
                authError.textContent = 'Error loading profile. Check console.';
            }

        } else {
            // User is signed out
            currentUserRole = null;
            currentUserTempleId = null;
            tempGoogleUser = null;
            showView(authView, signupOptionsView, signupFormView, servantView, authorityView, fullScreenCounterView, logoutBtn, 'auth-view');
        }
        setLoading(loadingOverlay, false);
    });

});
