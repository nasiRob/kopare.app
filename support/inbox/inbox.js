import { firebaseConfig, FIREBASE_SDK_VERSION as V } from "../firebase-config.js";

const base = `https://www.gstatic.com/firebasejs/${V}`;
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const CANNED = [
  ["Join with a code", "Ask your co-parent for their invite code, then in Kopare open Join and enter it. You can bring what you already added, or join without moving anything."],
  ["Codes expire", "Invite codes come from your co-parent's Invite screen and last 3 days. If yours has expired, ask them for a new one."],
  ["Different Apple ID", "A common cause is signing in with a different Apple ID than before. Could you check which Apple ID you used the first time?"],
  ["Still free", "Kopare is free, with nothing locked behind payment. The optional paid tier is just a way to support the app."],
];

const S = { chats: [], filter: "open", sel: null, msgs: [], online: false, summaryFor: null };
let fb = null, unsubChats = null, unsubMsgs = null, unsubCfg = null;

function gate(title, text, btnLabel, onBtn, err) {
  $("admin").hidden = true; $("gate").hidden = false;
  $("gateTitle").textContent = title; $("gateText").textContent = text;
  const b = $("gateBtn"); b.hidden = !btnLabel; b.textContent = btnLabel || ""; b.onclick = onBtn; b.disabled = false;
  const e = $("gateErr"); e.hidden = !err; e.textContent = err || "";
}

async function boot() {
  gate("Inbox", "Loading…");
  try {
    const [appM, authM, fsM, fnM] = await Promise.all([
      import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-firestore.js`), import(`${base}/firebase-functions.js`),
    ]);
    // Separate named app so this session never shares (or clobbers) the visitor's anonymous session.
    const app = appM.initializeApp(firebaseConfig, "inbox");
    fb = { ...authM, ...fsM, ...fnM };
    fb.auth = authM.getAuth(app); fb.db = fsM.getFirestore(app); fb.fns = fnM.getFunctions(app);
  } catch (e) {
    console.error(e);
    return gate("Can't load", "The chat service didn't load. Check your connection.", "Reload", () => location.reload());
  }
  try { await fb.getRedirectResult(fb.auth); } catch (e) { console.warn("redirect result", e.code); }
  fb.onAuthStateChanged(fb.auth, onUser);
}

async function onUser(user) {
  teardown();
  if (!user || user.isAnonymous) {
    return gate("Support inbox", "Sign in with the Apple ID that has support access.", "Sign in with Apple", signIn);
  }
  let claims;
  try { claims = (await user.getIdTokenResult(true)).claims; }
  catch (e) { return gate("Can't verify", "We couldn't check your access. Try again.", "Sign out", signOut, e.code || ""); }
  if (claims.supportAdmin !== true) {
    return gate("Not authorised", `${user.email || "This account"} doesn't have support access.`, "Sign out", signOut);
  }
  $("gate").hidden = true; $("admin").hidden = false;
  startInbox();
}

async function signIn() {
  const provider = new fb.OAuthProvider("apple.com");
  provider.addScope("email"); provider.addScope("name");
  $("gateBtn").disabled = true; $("gateErr").hidden = true;
  // Popup everywhere, phones included. Redirect sign-in silently fails in
  // Safari (and Chrome) when the page (kopare.app) and authDomain
  // (firebaseapp.com) differ: the browser partitions the storage the
  // redirect result lives in, so you come back signed out. A popup opened
  // from this tap is allowed on iOS. Redirect is only a last resort.
  try {
    await fb.signInWithPopup(fb.auth, provider);
  } catch (e) {
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(e.code)) {
      try { await fb.signInWithRedirect(fb.auth, provider); return; } catch (e2) { e = e2; }
    }
    $("gateBtn").disabled = false;
    if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
    $("gateErr").hidden = false;
    $("gateErr").textContent = e.code === "auth/unauthorized-domain" ? "This domain isn't authorised for sign-in yet."
      : e.code === "auth/operation-not-allowed" ? "Sign in with Apple isn't set up for this project yet." : `Sign-in didn't work (${e.code || "unknown"}). Please try again.`;
  }
}
function signOut() { return fb.signOut(fb.auth); }
$("signOutBtn").onclick = signOut;

function teardown() { [unsubChats, unsubMsgs, unsubCfg].forEach((u) => u && u()); unsubChats = unsubMsgs = unsubCfg = null; S.chats = []; S.sel = null; }

// ---------- Inbox ----------
function startInbox() {
  unsubCfg = fb.onSnapshot(fb.doc(fb.db, "supportConfig", "public"), (s) => { S.online = s.exists() && s.data().online === true; renderOnline(); }, () => {});
  const q = fb.query(fb.collection(fb.db, "supportChats"), fb.orderBy("lastMessageAt", "desc"), fb.limit(200));
  unsubChats = fb.onSnapshot(q, (s) => {
    S.chats = s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
    S.listErr = null; renderList(); if (S.sel) renderHeader();
  }, (e) => { S.listErr = e.code === "failed-precondition" ? "The chat index isn't ready yet." : "Couldn't load chats."; renderList(); });
  openFromHash();
}

$("onlineToggle").onclick = async () => {
  try { await fb.setDoc(fb.doc(fb.db, "supportConfig", "public"), { online: !S.online }, { merge: true }); }
  catch (e) { alert("Couldn't change your status."); }
};
function renderOnline() {
  const t = $("onlineToggle"); t.setAttribute("aria-pressed", S.online);
  t.querySelector(".dot").className = "dot" + (S.online ? "" : " off");
  $("onlineLabel").textContent = S.online ? "Online" : "Away";
}

function displayName(c) { return c.linkedName || `Visitor ${c.id.slice(0, 3).toUpperCase()}`; }
function ago(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts), m = Math.round((Date.now() - d) / 60000);
  if (m < 1) return "now"; if (m < 60) return m + "m"; if (m < 1440) return Math.round(m / 60) + "h";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
function counts() { const c = { open: 0, waiting: 0, closed: 0 }; S.chats.forEach((x) => { c[x.status] = (c[x.status] || 0) + 1; }); return c; }

document.querySelectorAll("#filters button").forEach((b) => b.onclick = () => { S.filter = b.dataset.f; renderList(); });

function renderList() {
  const c = counts();
  document.querySelectorAll("#filters button").forEach((b) => {
    const f = b.dataset.f; b.setAttribute("aria-pressed", S.filter === f);
    b.textContent = f[0].toUpperCase() + f.slice(1) + (f !== "closed" && c[f] ? ` ${c[f]}` : "");
  });
  const box = $("convs"); box.textContent = "";
  if (S.listErr) { box.append(el("div", "empty", S.listErr)); return; }
  const rows = S.chats.filter((x) => x.status === S.filter);
  if (!rows.length) { box.append(el("div", "empty", S.filter === "closed" ? "No closed chats." : "Nothing here. New chats will show up on their own.")); return; }
  for (const ch of rows) {
    const b = el("button", "conv" + (S.sel === ch.id ? " sel" : "")); b.type = "button";
    const top = el("div", "top"); top.append(el("b", null, displayName(ch)), el("span", null, ago(ch.lastMessageAt)));
    b.append(top, el("p", null, ch.lastMessagePreview || ""));
    if (ch.unreadByAdmin) b.append(el("span", "tag new", ch.linkedUserId ? "New · linked account" : "New"));
    else if (ch.status === "waiting") b.append(el("span", "tag wait", "Waiting on them"));
    else if (ch.status === "closed") b.append(el("span", "tag done", "Closed"));
    if (ch.blocked) b.append(el("span", "tag blk", "Paused"));
    b.onclick = () => select(ch.id);
    box.append(b);
  }
}

// ---------- Thread ----------
function openFromHash() {
  const m = /chat=([^&]+)/.exec(location.hash);
  if (m) select(decodeURIComponent(m[1]), true);
}
window.addEventListener("hashchange", () => { if (!$("admin").hidden) openFromHash(); });

function select(id, fromHash) {
  if (unsubMsgs) unsubMsgs();
  S.sel = id; S.msgs = [];
  if (!fromHash) history.replaceState(null, "", "#chat=" + encodeURIComponent(id));
  $("noSel").hidden = true; $("threadWrap").hidden = false;
  $("admin").classList.add("show-thread");
  $("replyErr").hidden = true;
  renderList(); renderHeader(); renderCanned();
  const q = fb.query(fb.collection(fb.db, "supportChats", id, "messages"), fb.orderBy("createdAt", "asc"));
  unsubMsgs = fb.onSnapshot(q, (s) => {
    S.msgs = s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
    renderMsgs(); markRead();
  }, () => { const b = $("tMsgs"); b.textContent = ""; b.append(el("div", "sys err", "Couldn't load this conversation.")); });
  loadSummary(id);
}
$("backBtn").onclick = () => { $("admin").classList.remove("show-thread"); S.sel = null; history.replaceState(null, "", location.pathname); renderList(); };

function cur() { return S.chats.find((x) => x.id === S.sel); }
function renderHeader() {
  const c = cur(); if (!c) { $("thName").textContent = "Chat " + (S.sel || "").slice(0, 3).toUpperCase(); return; }
  $("thName").textContent = displayName(c);
  $("thMeta").textContent = c.source === "app" ? "from the app" : "from the web";
  const cb = $("closeBtn"); cb.textContent = c.status === "closed" ? "Reopen chat" : "Close chat";
}
function markRead() {
  const c = cur();
  if (c && c.unreadByAdmin) fb.updateDoc(fb.doc(fb.db, "supportChats", S.sel), { unreadByAdmin: false }).catch(() => {});
}
$("closeBtn").onclick = async () => {
  const c = cur(); if (!c) return;
  try { await fb.updateDoc(fb.doc(fb.db, "supportChats", S.sel), { status: c.status === "closed" ? "open" : "closed" }); }
  catch { showReplyErr("Couldn't update the chat status."); }
};

function fmt(ts) { if (!ts) return ""; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
function renderMsgs() {
  const box = $("tMsgs"), near = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  const f = document.createDocumentFragment();
  const c = cur();
  if (c && c.faqTopic) f.append(el("div", "sys", `Last quick reply tapped: ${c.faqTopic}`));
  for (const m of S.msgs) {
    if (m.sender === "system") { f.append(el("div", "sys", m.text)); continue; }
    const mine = m.sender === "admin";
    f.append(el("div", "msg " + (mine ? "me" : "them"), m.text), el("div", "who" + (mine ? " r" : ""), `${mine ? "You" : displayName(c || { id: S.sel })} · ${fmt(m.createdAt)}`));
  }
  if (!S.msgs.length) f.append(el("div", "sys", "No messages yet."));
  box.replaceChildren(f);
  if (near || box.dataset.sel !== S.sel) { box.scrollTop = box.scrollHeight; box.dataset.sel = S.sel; }
}

function renderCanned() {
  const box = $("canned"); box.textContent = "";
  for (const [label, text] of CANNED) {
    const b = el("button", null, label); b.type = "button";
    b.onclick = () => { const i = $("replyInput"); i.value = i.value ? i.value + "\n" + text : text; i.focus(); autosize(); };
    box.append(b);
  }
}
function showReplyErr(t) { const e = $("replyErr"); e.hidden = !t; e.textContent = t || ""; }
const ri = $("replyInput");
function autosize() { ri.style.height = "auto"; ri.style.height = Math.min(ri.scrollHeight, 120) + "px"; }
ri.addEventListener("input", autosize);
ri.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $("replyForm").requestSubmit(); } });
$("replyForm").onsubmit = async (e) => {
  e.preventDefault();
  const text = ri.value.trim(); if (!text || !S.sel) return;
  showReplyErr("");
  ri.value = ""; autosize();
  try {
    await fb.addDoc(fb.collection(fb.db, "supportChats", S.sel, "messages"), { sender: "admin", authorUid: fb.auth.currentUser.uid, text, createdAt: fb.serverTimestamp() });
  } catch (err) {
    ri.value = text; autosize();
    showReplyErr("That didn't send. Try again.");
  }
};

// ---------- Account panel ----------
// Rendered into the desktop sidebar (#acct) and, below 900px, a collapsible section (#acctM).
function accountViews(box, r, state) {
  box.textContent = "";
  box.append(el("h3", null, "Account"));
  if (state === "loading") { box.append(el("p", null, "Loading…")); return; }
  if (state === "error") { box.append(el("p", null, "Couldn't load account details.")); return; }
  if (!r || r.linked === false) { box.append(el("p", null, "Not linked to a Kopare account. This visitor hasn't shared a support code.")); return; }
  const kv = (k, v) => { const d = el("div", "kv"); d.append(el("span", null, k), el("span", null, v == null ? "n/a" : String(v))); box.append(d); };
  const cals = r.calendars || [];
  kv("Name", r.name); kv("Signed up", fmtDate(r.signedUpAt)); kv("App", r.lastAppVersion);
  kv("Calendars", cals.length ? cals.map((c) => `${c.memberCount} member${c.memberCount === 1 ? "" : "s"}`).join(", ") : "0");
  kv("Events", r.eventCount);
  const fbk = r.recentFeedback || [];
  if (fbk.length) {
    const h = el("h3", null, "Recent feedback"); h.style.marginTop = "16px"; box.append(h);
    fbk.forEach((x) => box.append(el("p", "fb", `"${x.message}" · ${fmtDate(x.createdAt) || ""}`)));
  }
}
function fmtDate(v) { if (!v) return null; const d = v._seconds != null ? new Date(v._seconds * 1000) : v.seconds != null ? new Date(v.seconds * 1000) : new Date(v); return isNaN(d) ? null : d.toLocaleString([], { month: "short", day: "numeric", year: "numeric" }); }
function flagEl() {
  const f = el("div", "flag"); f.append(el("b", null, "May have started their own calendar"), document.createTextNode("One calendar with one member and no events. Suggest joining by code."));
  return f;
}
function paintAccount(r, state) {
  accountViews($("acct"), r, state);
  accountViews($("acctMBody"), r, state);
  const cals = (r && r.calendars) || [];
  const flagged = state === "ok" && r && r.linked !== false && cals.length === 1 && cals[0].memberCount === 1 && (r.eventCount || 0) === 0;
  $("flagM").textContent = "";
  if (flagged) { $("flagM").append(flagEl()); $("acct").querySelector(".kv:last-of-type").after(flagEl()); }
  let line = "Account";
  if (state === "loading") line = "Account · loading…";
  else if (state === "error") line = "Account · couldn't load";
  else if (!r || r.linked === false) line = "Account · not linked";
  else line = `${r.name || "Account"} · ${cals.length} calendar${cals.length === 1 ? "" : "s"} · ${r.eventCount == null ? "?" : r.eventCount} event${r.eventCount === 1 ? "" : "s"}`;
  $("acctSum").textContent = line;
}
async function loadSummary(id) {
  $("acctM").open = false;
  paintAccount(null, "loading");
  let r;
  try { r = (await fb.httpsCallable(fb.fns, "getSupportAccountSummary")({ chatId: id })).data; }
  catch (e) { if (S.sel === id) paintAccount(null, "error"); return; }
  if (S.sel === id) paintAccount(r, "ok");
}

boot();
