// Visitor page: callables only. No Firebase Auth, no Firestore. The chat token never appears in a URL or a log.
import { firebaseConfig, FIREBASE_SDK_VERSION as V } from "./firebase-config.js";

const base = `https://www.gstatic.com/firebasejs/${V}`;
const $ = (id) => document.getElementById(id);

// ---------- Static content: quick replies ----------
const ICONS = {
  cal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  join: '<path d="M15 3h6v6M10 14 21 3M21 14v7H3V3h7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  money: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
};
const QUICK = [
  { id: "coparent-calendar", icon: "cal", label: "I can't see my co-parent's calendar",
    title: "This usually means you started your own calendar",
    steps: ["Ask your co-parent for their invite code.", "In Kopare, open Join and enter it.",
      "You can bring what you already added, or join without moving anything."] },
  { id: "join-code", icon: "join", label: "How do I join with an invite code?",
    title: "Where the code comes from",
    text: "Codes come from your co-parent's Invite screen and last 3 days. If yours has expired, ask them for a new one." },
  { id: "missing-data", icon: "search", label: "My events or data are missing",
    title: "Two common causes",
    bullets: ["You signed in with a different Apple ID than before.", "You started a new calendar instead of joining an existing one."],
    text: "If neither sounds right, we're happy to look into it.", human: true },
  { id: "free", icon: "money", label: "Is Kopare really free?",
    title: "Yes, it's free",
    text: "Kopare is free, with nothing locked behind payment. The optional paid tier is just a way to support the app." },
  { id: "human", icon: "chat", label: "Something else. Talk to a person" },
];
const CHECK = '<svg class="i" viewBox="0 0 24 24"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>';
const CHEV = '<svg class="i chev" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>';

// ---------- State ----------
const STORE_KEY = "kopareSupportChat";
const FAST = 4000, SLOW = 20000, IDLE_STOP = 30 * 60 * 1000;
const st = {
  chat: null,           // {chatId, token}: memory copy, mirrored to localStorage when it works
  info: { status: null, blocked: false, linked: false, linkedName: null },
  online: null,
  messages: [],         // server messages {id, sender, text, createdAt(ms)} plus optimistic {local:true}
  since: 0,             // newest server createdAt seen
  pending: [],
  faq: null, fixed: false, topic: null,
  appVersion: null, code: null,
  notice: null,         // {kind, text, retry?}
  linkNote: null,
  stopped: false,       // polling paused after 30 min without news
  sending: false,
};
let fns = null, call = null, timer = null, lastNewAt = Date.now(), failures = 0, fetching = false, seq = 0;

// Fragment only, never a query string. Read once, then strip.
const frag = new URLSearchParams(location.hash.replace(/^#/, ""));
st.code = (frag.get("code") || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || null;
st.appVersion = (frag.get("v") || "").slice(0, 40) || null;
if (location.hash) history.replaceState(null, "", location.pathname + location.search);

function loadChat() {
  try { const v = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); if (v && v.chatId && v.token) return { chatId: v.chatId, token: v.token }; } catch {}
  return null;
}
function saveChat(c) { st.chat = c; try { localStorage.setItem(STORE_KEY, JSON.stringify(c)); } catch {} }
function forgetChat() { st.chat = null; st.messages = []; st.since = 0; st.info = { status: null, blocked: false, linked: false, linkedName: null }; try { localStorage.removeItem(STORE_KEY); } catch {} }

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const svg = (paths, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24">${paths}</svg>`;
const hasConvo = () => st.messages.length > 0 || st.pending.length > 0;

// ---------- Render ----------
function renderStatus() {
  const s = $("status");
  if (st.online === true) s.innerHTML = '<span class="dot"></span><span>Online now · usually replies in minutes</span>';
  else if (st.online === false) s.innerHTML = '<span class="dot off"></span><span>Away · replies within a few hours</span>';
  else s.innerHTML = "";
  s.hidden = st.online === null;
}

function renderChips() {
  const box = $("chips");
  box.textContent = "";
  const show = !hasConvo() && !st.faq;
  box.hidden = !show;
  if (!show) return;
  for (const q of QUICK) {
    const b = el("button", "chip");
    b.type = "button";
    b.innerHTML = svg(ICONS[q.icon]);
    b.append(document.createTextNode(q.label));
    b.insertAdjacentHTML("beforeend", CHEV);
    b.addEventListener("click", () => pickQuick(q));
    box.append(b);
  }
}

function renderFaq(f) {
  const q = QUICK.find((x) => x.id === st.faq);
  if (!q || !q.title) return;
  f.append(el("div", "msg me", q.label));
  const a = el("div", "answer");
  const t = el("div", "t"); t.innerHTML = CHECK; t.append(el("span", null, q.title)); a.append(t);
  if (q.steps) { const ol = el("ol"); q.steps.forEach((x) => ol.append(el("li", null, x))); a.append(ol); }
  if (q.bullets) { const ul = el("ul"); q.bullets.forEach((x) => ul.append(el("li", null, x))); a.append(ul); }
  if (q.text) a.append(el("p", null, q.text));
  if (!hasConvo()) {
    const row = el("div", "row");
    if (q.human) {
      const talk = el("button", "btn pri", "Talk to a person"); talk.type = "button";
      talk.addEventListener("click", () => needHelp(q));
      row.append(talk);
    } else {
      const fixed = el("button", "btn sec", "That fixed it"); fixed.type = "button";
      fixed.addEventListener("click", () => { st.faq = null; st.fixed = true; render(); });
      const help = el("button", "btn pri", "I still need help"); help.type = "button";
      help.addEventListener("click", () => needHelp(q));
      row.append(fixed, help);
    }
    a.append(row);
  }
  f.append(a);
}

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts), now = new Date();
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === now.toDateString() ? t : d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + t;
}

function renderThread() {
  const box = $("thread");
  const f = document.createDocumentFragment();
  if (st.fixed && !hasConvo()) f.append(el("div", "sys", "Glad that helped. Pick another question or type below if anything else comes up."));
  renderFaq(f);
  let lastSender = null;
  for (const m of st.messages) {
    if (m.sender === "system") { f.append(el("div", "sys", m.text)); lastSender = null; continue; }
    const mine = m.sender === "visitor";
    if (!mine && lastSender !== "admin") f.append(el("div", "who", `Kopare Support · ${fmtTime(m.createdAt)}`));
    f.append(el("div", "msg " + (mine ? "me" : "them"), m.text));
    lastSender = m.sender;
  }
  for (const p of st.pending) f.append(el("div", "msg me pending", p.text));
  if (st.online === false && hasConvo()) {
    const last = st.pending.length ? "visitor" : (st.messages[st.messages.length - 1] || {}).sender;
    if (last === "visitor") f.append(el("div", "sys", "We're offline right now. Your message is saved, and you'll get an answer here when you come back, usually within a few hours."));
  }
  if (st.stopped) {
    const r = el("button", "btn sec", "Tap to refresh"); r.type = "button"; r.style.alignSelf = "center";
    r.addEventListener("click", () => { st.stopped = false; lastNewAt = Date.now(); render(); poll(true); });
    f.append(r);
  }
  box.replaceChildren(f);
}

function renderNotices() {
  const box = $("notices");
  box.textContent = "";
  if (st.info.blocked) box.append(el("div", "notice err", "We've paused this chat; try again later."));
  if (st.linkNote) box.append(el("div", "notice", st.linkNote));
  if (st.notice) {
    const n = el("div", "notice " + (st.notice.kind === "err" ? "err" : ""), st.notice.text);
    if (st.notice.retry) {
      n.append(document.createElement("br"));
      const b = el("button", "btn sec", "Try again"); b.type = "button";
      b.addEventListener("click", st.notice.retry); n.append(b);
    }
    box.append(n);
  }
}

function renderCode() {
  const slot = $("codeSlot");
  slot.textContent = "";
  const card = el("div", "code-card");
  if (st.info.linked) {
    card.append(el("b", null, "Linked to your Kopare account"), document.createElement("br"),
      document.createTextNode("Thanks, that helps us find what you're seeing."));
  } else {
    card.append(document.createTextNode("Opened from the Kopare app? Your account is linked automatically."));
  }
  slot.append(card);
}

function render() {
  const body = $("vbody");
  const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 120;
  renderStatus(); renderChips(); renderThread(); renderNotices(); renderCode();
  if (nearBottom) requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
}

// ---------- Functions SDK (no auth) ----------
async function boot() {
  st.chat = loadChat();
  render();
  try {
    const [appM, fnM] = await Promise.all([import(`${base}/firebase-app.js`), import(`${base}/firebase-functions.js`)]);
    fns = fnM.getFunctions(appM.initializeApp(firebaseConfig));
    call = (name, data) => fnM.httpsCallable(fns, name)(data).then((r) => r.data);
  } catch (e) {
    console.warn("Functions SDK failed to load");
    st.notice = { kind: "err", text: "We couldn't reach the chat service. Quick answers still work; check your connection and try again to message us.", retry: () => location.reload() };
    return render();
  }
  if (st.chat) { linkIfPossible(); poll(true); }
}

// ---------- Polling ----------
function schedule() {
  clearTimeout(timer);
  if (!st.chat || st.stopped) return;
  timer = setTimeout(() => poll(false), document.visibilityState === "visible" ? FAST : SLOW);
}
function invalidChat() {
  forgetChat();
  st.notice = { kind: "warn", text: "We couldn't find your earlier chat, so this is a fresh one. Type below to start again." };
}
async function poll(immediate) {
  if (!st.chat || !call || fetching) return;
  if (!immediate && Date.now() - lastNewAt > IDLE_STOP) { st.stopped = true; render(); return; }
  fetching = true;
  try {
    const r = await call("supportFetch", { chatId: st.chat.chatId, token: st.chat.token, since: st.since || undefined });
    failures = 0;
    if (st.notice && st.notice.poll) st.notice = null;
    st.online = r.online === true;
    st.info = { status: r.chat?.status ?? null, blocked: r.chat?.blocked === true, linked: !!r.chat?.linked, linkedName: r.chat?.linkedName ?? null };
    const fresh = (r.messages || []).filter((m) => !st.messages.some((x) => x.id === m.id));
    if (fresh.length) {
      // Replace optimistic copies of our own messages.
      for (const m of fresh) {
        if (m.sender === "visitor") {
          const i = st.messages.findIndex((x) => x.local && x.text === m.text);
          if (i >= 0) st.messages.splice(i, 1);
        }
        st.since = Math.max(st.since, m.createdAt || 0);
      }
      st.messages.push(...fresh);
      st.messages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      lastNewAt = Date.now();
    }
    render();
  } catch (e) {
    const code = e && e.code;
    if (code === "functions/permission-denied" || code === "functions/not-found") invalidChat();
    else if (++failures >= 3) st.notice = { kind: "warn", poll: true, text: "Having trouble reaching us. We'll keep retrying." };
    render();
  } finally {
    fetching = false;
    schedule();
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && st.chat && !st.stopped) poll(true); else schedule();
});

// ---------- Sending ----------
async function sendText(text) {
  text = text.trim();
  if (!text || text.length > 2000 || st.sending) return false;
  if (st.info.blocked) { render(); return false; }
  if (!call) { st.notice = { kind: "err", text: "We couldn't reach the chat service. Please check your connection and try again." }; render(); return false; }
  const p = { text, id: ++seq };
  st.pending.push(p); st.notice = null; st.sending = true; render();
  try {
    if (!st.chat) {
      const r = await call("supportStartChat", { text, faqTopic: st.topic || null, appVersion: st.appVersion || null });
      saveChat({ chatId: r.chatId, token: r.token });
      linkIfPossible();
    } else {
      const r = await call("supportSendMessage", { chatId: st.chat.chatId, token: st.chat.token, text, faqTopic: st.topic || null });
      st.messages.push({ id: r.messageId || "local-" + p.id, sender: "visitor", text, createdAt: Date.now(), local: true });
    }
    st.pending = st.pending.filter((x) => x !== p);
    st.stopped = false; lastNewAt = Date.now();
    st.sending = false; render();
    poll(true);
    return true;
  } catch (e) {
    console.warn("send failed", e && e.code);
    st.pending = st.pending.filter((x) => x !== p);
    st.sending = false;
    const c = e && e.code;
    if (c === "functions/resource-exhausted" && st.chat) st.info.blocked = true;
    else if (c === "functions/resource-exhausted") st.notice = { kind: "err", text: "That's a lot of new chats from one place. Please try again in a little while." };
    else if (c === "functions/permission-denied") invalidChat();
    else st.notice = { kind: "err", text: "That didn't send. Please check your connection and try again." };
    render();
    const inp = $("composerInput"); if (!inp.value) { inp.value = text; autosize(); }
    return false;
  }
}

function pickQuick(q) {
  st.topic = q.id; st.fixed = false; st.notice = null;
  if (q.id === "human") { st.faq = null; render(); $("composerInput").focus(); return; }
  st.faq = q.id; render(); // quick replies stay local: no chat is created
}
async function needHelp(q) {
  $("composerInput").focus();
  await sendText(`I still need help: ${q.label}`);
}

// ---------- Automatic account link (#code=) ----------
async function linkIfPossible() {
  if (!st.code || !st.chat || !call) return;
  const code = st.code; st.code = null;
  try {
    await call("linkSupportChat", { chatId: st.chat.chatId, token: st.chat.token, code });
    st.linkNote = null;
    poll(true);
  } catch (e) {
    console.warn("link failed", e && e.code);
    st.linkNote = "We couldn't link your account automatically, but you can keep chatting and we'll still help.";
    render();
  }
}

// ---------- Composer ----------
const input = $("composerInput");
function autosize() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 120) + "px"; }
input.addEventListener("input", autosize);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("composerForm").requestSubmit(); }
});
$("composerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || st.info.blocked) return;
  input.value = ""; autosize();
  await sendText(text);
});

boot();
