// onboard.js
// Requires firebase-config.js (init) and firebase compat SDKs loaded first.

if (!window.db || !window.auth) {
  alert("Firebase not initialized. Ensure firebase-config.js is present and SDKs are loaded.");
  throw new Error("Firebase not initialized");
}

const btnLeader = document.getElementById('btnLeader');
const btnServer = document.getElementById('btnServer');
const authArea = document.getElementById('authArea');
const googleBtn = document.getElementById('googleBtn');
const emailToggleBtn = document.getElementById('emailToggleBtn');
const emailForm = document.getElementById('emailForm');
const emailInput = document.getElementById('emailInput');
const passInput = document.getElementById('passInput');
const emailSignUpBtn = document.getElementById('emailSignUpBtn');
const emailSignInBtn = document.getElementById('emailSignInBtn');
const signedInInfo = document.getElementById('signedInInfo');
const signedName = document.getElementById('signedName');
const displayNameInput = document.getElementById('displayNameInput');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const signOutBtn = document.getElementById('signOutBtn');
const statusEl = document.getElementById('status');
const alreadySigned = document.getElementById('alreadySigned');

let chosenRole = null; // 'leader' or 'server'

// quick safe-redirect helper
function goToRolePage(role) {
  if (role === 'leader') location.href = 'leader.html';
  else location.href = 'server.html';
}

// pick role buttons
btnLeader.addEventListener('click', ()=> chooseRole('leader'));
btnServer.addEventListener('click', ()=> chooseRole('server'));

function chooseRole(role){
  chosenRole = role;
  statusEl.textContent = '';
  authArea.style.display = 'block';
  // visually mark selection
  if (role === 'leader') {
    btnLeader.classList.remove('btn-ghost'); btnLeader.classList.add('btn');
    btnServer.classList.remove('btn'); btnServer.classList.add('btn-ghost');
  } else {
    btnServer.classList.remove('btn-ghost'); btnServer.classList.add('btn');
    btnLeader.classList.remove('btn'); btnLeader.classList.add('btn-ghost');
  }
  // If already signed-in and profile exists, redirect instantly
  const u = auth.currentUser;
  if (u) {
    statusEl.textContent = 'Checking profile...';
    db.ref(`users/${u.uid}`).once('value').then(snap => {
      const val = snap.val();
      if (val && val.role) {
        // If saved role differs, offer to switch or continue
        if (val.role === chosenRole) {
          statusEl.textContent = 'Profile found. Redirecting...';
          setTimeout(()=> goToRolePage(chosenRole), 700);
        } else {
          // ask user whether to keep old or update
          if (confirm(`You already have role "${val.role}". Do you want to update your role to "${chosenRole}"?`)) {
            db.ref(`users/${u.uid}`).update({ role: chosenRole }).then(()=> goToRolePage(chosenRole));
          } else {
            goToRolePage(val.role);
          }
        }
      } else {
        // show name/profile UI to finish onboarding
        showSignedInUI(u);
      }
    });
  }
}

// Email toggle
emailToggleBtn.addEventListener('click', ()=> {
  emailForm.style.display = emailForm.style.display === 'block' ? 'none' : 'block';
});

// Google sign-in
googleBtn.addEventListener('click', ()=> {
  if (!chosenRole) return alert('Choose Leader or Server first');
  const provider = new GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    console.error('Google sign-in failed', err);
    alert('Sign-in failed: ' + err.message);
  });
});

// Email sign-up / sign-in
emailSignUpBtn.addEventListener('click', ()=> {
  if (!chosenRole) return alert('Choose Leader or Server first');
  const email = emailInput.value.trim(), pass = passInput.value;
  if (!email || !pass) return alert('Enter email and password');
  auth.createUserWithEmailAndPassword(email, pass).catch(err=> {
    console.error(err); alert('Sign-up failed: ' + err.message);
  });
});
emailSignInBtn.addEventListener('click', ()=> {
  if (!chosenRole) return alert('Choose Leader or Server first');
  const email = emailInput.value.trim(), pass = passInput.value;
  if (!email || !pass) return alert('Enter email and password');
  auth.signInWithEmailAndPassword(email, pass).catch(err=> {
    console.error(err); alert('Sign-in failed: ' + err.message);
  });
});

// Handle sign out
signOutBtn.addEventListener('click', ()=> auth.signOut());

// When user is signed in, show the profile input and allow saving profile
function showSignedInUI(user) {
  signedInInfo.hidden = false;
  signedName.textContent = user.email || user.displayName || user.uid;
  displayNameInput.value = user.displayName || '';
  statusEl.textContent = 'Fill display name and save to continue.';
}

// Auth observer
auth.onAuthStateChanged(user => {
  if (user) {
    // user signed in
    signedInInfo.hidden = false;
    signedName.textContent = user.email || user.displayName || user.uid;
    displayNameInput.value = user.displayName || '';
    // check if profile exists
    db.ref(`users/${user.uid}`).once('value').then(snap => {
      const val = snap.val();
      if (val && val.role) {
        // profile complete -> redirect to role page (unless chosenRole differs)
        if (!chosenRole) {
          // no selection yet — use saved role
          goToRolePage(val.role);
        } else if (val.role === chosenRole) {
          goToRolePage(chosenRole);
        } else {
          // ask whether to update role
          if (confirm(`Your saved role is "${val.role}". Change to "${chosenRole}"?`)) {
            db.ref(`users/${user.uid}`).update({ role: chosenRole, name: displayNameInput.value || user.displayName || '' })
              .then(()=> goToRolePage(chosenRole));
          } else {
            goToRolePage(val.role);
          }
        }
      } else {
        // not finished onboarding — show UI and save when user clicks Save
        showSignedInUI(user);
      }
    });
  } else {
    // signed out
    signedInInfo.hidden = true;
  }
});

// Save profile and redirect
saveProfileBtn.addEventListener('click', async ()=> {
  const user = auth.currentUser;
  if (!user) return alert('Sign in first');
  if (!chosenRole) return alert('Choose Leader or Server first');
  const displayName = (displayNameInput.value || '').trim();
  if (!displayName) return alert('Enter a display name');

  const payload = { uid: user.uid, name: displayName, role: chosenRole, createdAt: Date.now() };
  try {
    await db.ref(`users/${user.uid}`).set(payload);
    // Also update Firebase auth displayName (optional)
    user.updateProfile({ displayName }).catch(()=>{});
    // If leader, ensure leaders record exists (used by other flows)
    if (chosenRole === 'leader') {
      const leaderRef = db.ref(`leaders/${user.uid}`);
      const snap = await leaderRef.once('value');
      if (!snap.exists()) {
        await leaderRef.set({ uid: user.uid, name: displayName, createdAt: Date.now(), passwordHash: null });
      } else {
        await leaderRef.update({ name: displayName });
      }
    }
    statusEl.textContent = 'Saved! Redirecting...';
    setTimeout(()=> goToRolePage(chosenRole), 700);
  } catch(err) {
    console.error(err);
    alert('Failed to save profile: ' + err.message);
  }
});

// Auto-redirect if user already signed-in with profile and role on page load
(async function autoRedirectIfReady(){
  const user = auth.currentUser;
  if (!user) {
    // Might not be loaded yet; rely on onAuthStateChanged
    return;
  }
  const snap = await db.ref(`users/${user.uid}`).once('value');
  const val = snap.val();
  if (val && val.role) goToRolePage(val.role);
})();
