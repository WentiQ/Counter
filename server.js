// server.js - server page logic
if (!window.db || !window.auth) throw new Error("Firebase not initialized");

const now = ()=> Date.now();
async function sha256Hex(str){
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

/* --- DOM --- */
const serverNameDisplay = document.getElementById('serverNameDisplay');
const authArea = document.getElementById('authArea');
const myCountEl = document.getElementById('myCount');
const totalCountEl = document.getElementById('totalCount');
const feedEl = document.getElementById('feed');
const connectedInfo = document.getElementById('connectedInfo');
const connectedLeaderName = document.getElementById('connectedLeaderName');
const connectCard = document.getElementById('connectCard');
const leaderIdInput = document.getElementById('leaderIdInput');
const leaderPwInput = document.getElementById('leaderPwInput');
const connectBtn = document.getElementById('connectBtn');
const connectStatus = document.getElementById('connectStatus');
const disk = document.getElementById('disk');
const fsOverlay = document.getElementById('fsOverlay');
const saveNameBtn = document.getElementById('saveNameBtn');
const nameInput = document.getElementById('nameInput');
const disconnectBtn = document.getElementById('disconnectBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');

/* --- State --- */
let currentUser=null, connectedLeaderId=null, leaderName=null;
let listeners=[], hbInterval=null;

/* --- Auth --- */
function renderAuthUI(user){
  if(!user){
    authArea.innerHTML=`<button id="signInBtn" class="btn-ghost">Sign in</button>`;
    document.getElementById('signInBtn').onclick=()=>auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    serverNameDisplay.textContent="Not signed in";
  } else {
    authArea.innerHTML=`${user.email} <button id="signOutBtn" class="btn-ghost">Sign out</button>`;
    document.getElementById('signOutBtn').onclick=()=>auth.signOut();
  }
}
auth.onAuthStateChanged(async user=>{
  renderAuthUI(user);
  if(!user){ location.href="index.html"; return; }
  currentUser=user;
  const snap=await db.ref(`users/${user.uid}`).once('value');
  const val=snap.val();
  if(val && val.role==='leader'){ location.href="leader.html"; return; }
  if(val && val.name){ nameInput.value=val.name; serverNameDisplay.textContent="Server: "+val.name; }
  else serverNameDisplay.textContent="Server";
});

/* --- Save Name --- */
saveNameBtn.onclick=async ()=>{
  if(!currentUser) return;
  const name=nameInput.value.trim(); if(!name) return;
  await db.ref(`users/${currentUser.uid}`).update({name});
  if(connectedLeaderId) await db.ref(`connections/${connectedLeaderId}/${currentUser.uid}`).update({name});
  serverNameDisplay.textContent="Server: "+name;
};

/* --- Connect to Leader --- */
connectBtn.onclick = async () => {
  if (!currentUser) return alert("Sign in first");
  const lid = leaderIdInput.value.trim();
  const pw = leaderPwInput.value.trim();
  if (!lid || !pw) {
    connectStatus.textContent = "Enter leader ID and password";
    return;
  }

  try {
    const snap = await db.ref(`leaders/${lid}`).once("value");
    if (!snap.exists()) {
      connectStatus.textContent = "Leader not found";
      return;
    }
    const leaderData = snap.val();
    const hash = await sha256Hex(pw);
    if (leaderData.passwordHash !== hash) {
      connectStatus.textContent = "Incorrect password";
      return;
    }

    const name = nameInput.value.trim() || currentUser.displayName || "Server";
    await db.ref(`connections/${lid}/${currentUser.uid}`).set({
      uid: currentUser.uid,
      name,
      enabled: true,
      count: 0,
      lastActive: now()
    });
    await db.ref(`connections_by_server/${currentUser.uid}`).set({ leaderId: lid, connectedAt: now() });

    connectedLeaderId = lid; leaderName = leaderData.name || lid;
    updateConnectedUI(); attachListeners(); startHeartbeat();
    connectStatus.textContent = "✅ Connected successfully!";
  } catch (err) {
    console.error(err);
    connectStatus.textContent = "Error connecting to leader";
  }
};

/* --- Update UI --- */
function updateConnectedUI(){
  if(connectedLeaderId){
    connectedInfo.style.display="block"; connectedLeaderName.textContent=leaderName;
    connectCard.style.display="none";
  } else {
    connectedInfo.style.display="none"; connectCard.style.display="block";
    myCountEl.textContent="0"; totalCountEl.textContent="0"; feedEl.innerHTML="";
  }
}

/* --- Counting --- */
disk.onclick=recordTap; fsOverlay.onclick=recordTap;
let tapLock=false;
async function recordTap(){
  if(!currentUser||!connectedLeaderId||tapLock) return;
  tapLock=true; setTimeout(()=>tapLock=false,120);
  const uid=currentUser.uid, ts=now(), name=nameInput.value.trim()||currentUser.displayName||"Server";
  db.ref(`logs/${connectedLeaderId}`).push({serverId:uid,name,ts});
  db.ref(`connections/${connectedLeaderId}/${uid}`).transaction(c=>!c?{uid,name,count:1,lastActive:ts,enabled:true}:{...c,count:(c.count||0)+1,lastActive:ts});
}

/* --- Listeners --- */
function attachListeners(){
  detachListeners();
  const myRef=db.ref(`connections/${connectedLeaderId}/${currentUser.uid}/count`);
  myRef.on("value",s=>myCountEl.textContent=s.val()||0); listeners.push(myRef);

  const totalRef=db.ref(`connections/${connectedLeaderId}`);
  totalRef.on("value",s=>{
    let t=0; Object.values(s.val()||{}).forEach(c=>t+=c.count||0);
    totalCountEl.textContent=t;
  }); listeners.push(totalRef);

  const feedRef=db.ref(`logs/${connectedLeaderId}`).limitToLast(30);
  feedRef.on("value",s=>{
    feedEl.innerHTML=""; const arr=Object.values(s.val()||{}).sort((a,b)=>b.ts-a.ts);
    arr.forEach(it=>{
      const el=document.createElement('div'); el.className="feed-item";
      el.textContent=`${it.name} at ${new Date(it.ts).toLocaleTimeString()}`;
      feedEl.appendChild(el);
    });
  }); listeners.push(feedRef);
}
function detachListeners(){ listeners.forEach(r=>r.off()); listeners=[]; }

/* --- Heartbeat --- */
function startHeartbeat(){
  stopHeartbeat(); if(!connectedLeaderId) return;
  const ref=db.ref(`connections/${connectedLeaderId}/${currentUser.uid}/lastActive`);
  ref.set(now()); hbInterval=setInterval(()=>ref.set(now()),25000);
}
function stopHeartbeat(){ if(hbInterval){clearInterval(hbInterval);hbInterval=null;} }

/* --- Disconnect --- */
disconnectBtn.onclick=async()=>{
  if(!connectedLeaderId) return;
  await db.ref(`connections/${connectedLeaderId}/${currentUser.uid}`).remove();
  await db.ref(`connections_by_server/${currentUser.uid}`).remove();
  connectedLeaderId=null; leaderName=null; updateConnectedUI(); stopHeartbeat(); detachListeners();
};

/* --- Fullscreen --- */
fullscreenBtn.onclick=()=>toggleFullscreen();
function toggleFullscreen(){
  if(fsOverlay.style.display==="block") exitFullscreen(); else enterFullscreen();
}
function enterFullscreen(){
  document.querySelectorAll('.card,.header,.footer').forEach(el=>el.classList.add("fullscreen-hide"));
  fsOverlay.style.display="block"; window.addEventListener("keydown",escHandler);
}
function exitFullscreen(){
  document.querySelectorAll('.card,.header,.footer').forEach(el=>el.classList.remove("fullscreen-hide"));
  fsOverlay.style.display="none"; window.removeEventListener("keydown",escHandler);
}
function escHandler(e){ if(e.key==="Escape") exitFullscreen(); }
