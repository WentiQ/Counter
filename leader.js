// leader.js (UPDATED)
if (!window.db || !window.auth) {
  alert("Firebase not initialized. Check firebase-config.js and SDK includes.");
  throw new Error("Firebase not initialized");
}

function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])) }
async function sha256Hex(str){
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map(b => b.toString(16).padStart(2,'0')).join('');
}
const now = ()=> Date.now();
function humanAgo(ts){ if(!ts) return 'never'; const s = Math.floor((Date.now()-ts)/1000); if(s<10) return 'just now'; if(s<60) return s+'s ago'; if(s<3600) return Math.floor(s/60)+'m ago'; if(s<86400) return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; }

/* DOM */
const authAreaLeader = document.getElementById('authAreaLeader');
const leaderSignInBtn = document.getElementById('leaderSignInBtn');
const leaderIdEl = document.getElementById('leaderId');
const leaderPasswordInput = document.getElementById('leaderPasswordInput');
const setPasswordBtn = document.getElementById('setPasswordBtn');
const serversListEl = document.getElementById('serversList');
const feedEl = document.getElementById('feed');
const globalTotalEl = document.getElementById('globalTotal');

let currentUser = null;
let leaderId = null;

const leadersRef = db.ref('leaders');
const connectionsRef = db.ref('connections');
const logsRootRef = db.ref('logs');

/* Sign-in and auth behavior */
function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    console.warn('popup failed:', err);
    if (err.code === 'auth/operation-not-supported-in-this-environment' ||
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user') {
      auth.signInWithRedirect(provider);
    } else alert('Sign-in failed: ' + err.message);
  });
}
if (leaderSignInBtn) leaderSignInBtn.addEventListener('click', signInWithGoogle);

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    // signed out -> go back to index
    try { location.href = 'index.html'; } catch(e) { console.warn(e); }
    return;
  }
  // signed-in
  currentUser = user;
  leaderId = user.uid;
  authAreaLeader.innerHTML = `<div class="small muted">Signed in as <strong>${escapeHtml(user.displayName || user.email)}</strong></div>
    <button id="leaderSignOutBtn" class="btn-ghost" style="margin-left:8px">Sign out</button>`;
  document.getElementById('leaderSignOutBtn').addEventListener('click', ()=> auth.signOut());
  leaderIdEl.textContent = leaderId;
  // ensure leader record exists
  try {
    const snap = await db.ref(`leaders/${leaderId}`).once('value');
    if (!snap.exists()) {
      await db.ref(`leaders/${leaderId}`).set({ uid: leaderId, name: user.displayName || user.email, createdAt: now(), passwordHash: null });
    } else {
      const dat = snap.val();
      leaderPasswordInput.value = dat.passwordHash ? '••••••' : '';
    }
    attachConnectionsListener();
    attachFeedListener();
  } catch(err) {
    console.error('Error creating/reading leader record', err);
  }
});

/* Set password (hash stored) */
setPasswordBtn.addEventListener('click', async () => {
  if (!currentUser) return alert('Sign in first');
  const raw = (leaderPasswordInput.value || '').trim();
  const leaderRef = db.ref(`leaders/${leaderId}`);
  if (!raw) {
    await leaderRef.update({ passwordHash: null });
    alert('Password cleared; servers can connect without a password.');
    return;
  }
  const h = await sha256Hex(raw);
  await leaderRef.update({ passwordHash: h });
  alert('Password saved (hashed). Share the password string with your servers.');
});

/* Connections listener (show connected servers) */
function attachConnectionsListener(){
  if (!leaderId) return;
  const myConnsRef = db.ref(`connections/${leaderId}`);
  myConnsRef.on('value', snap => {
    const v = snap.val() || {};
    renderConnections(v);
    let total = 0;
    Object.keys(v).forEach(k => total += Number(v[k].count || 0));
    globalTotalEl.textContent = total;
  });
}

function renderConnections(conns){
  serversListEl.innerHTML = '';
  const items = Object.keys(conns || {}).map(k => ({ uid:k, ...conns[k]}));
  items.sort((a,b) => (b.count||0) - (a.count||0));
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'feed-item';
    const lastActive = item.lastActive || 0;
    div.innerHTML = `<div>
      <div style="font-weight:700;color:#052f5f">${escapeHtml(item.name || item.uid)}</div>
      <div class="small muted" style="margin-top:4px">id: ${escapeHtml(item.uid)}</div>
      <div class="small muted" style="margin-top:6px">inactive: ${humanAgo(lastActive)}</div>
    </div>
    <div style="text-align:right">
      <div class="server-pill">${item.count || 0}</div>
      <div style="margin-top:6px">
        <button class="btn-ghost btnDisable">${item.enabled ? 'Disable' : 'Enable'}</button>
      </div>
    </div>`;
    const btn = div.querySelector('.btnDisable');
    btn.addEventListener('click', async () => {
      const newState = !item.enabled;
      await db.ref(`connections/${leaderId}/${item.uid}`).update({ enabled: newState });
    });
    serversListEl.appendChild(div);
  });
}

/* Live feed */
function attachFeedListener(){
  if (!leaderId) return;
  const logsRef = db.ref(`logs/${leaderId}`).limitToLast(200);
  logsRef.on('value', snap => {
    const val = snap.val() || {};
    const arr = Object.keys(val).map(k => val[k]).sort((a,b) => b.ts - a.ts);
    feedEl.innerHTML = '';
    arr.forEach(item => {
      const d = new Date(item.ts);
      const time = d.toLocaleTimeString();
      const el = document.createElement('div');
      el.className = 'feed-item';
      el.innerHTML = `<div><div class="server-pill">${escapeHtml(item.name || item.serverId)}</div></div>
                      <div style="text-align:right;color:#334155"><div style="font-size:13px">${time}</div></div>`;
      feedEl.appendChild(el);
    });
  });
}

/* Add server manually (optional) */
async function addServerManually(){
  const name = prompt('Server name to add:');
  const uid = prompt('Server UID (paste their firebase auth uid):');
  if (!uid || !name) return;
  await db.ref(`connections/${leaderId}/${uid}`).set({ uid, name, enabled:true, count:0, lastActive: now() });
  alert('Server added');
}

/* Keyboard shortcut to add server */
window.addEventListener('keydown', (e) => {
  if (e.key === 'F2') addServerManually();
});
