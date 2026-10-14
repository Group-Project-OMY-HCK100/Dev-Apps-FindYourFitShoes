import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import axios from "axios";
import Icon from "../components/Icon";
import ViewState from "../components/ViewState";
import { shoeName } from "../data/products";
import { useChat } from "../lib/chat-context";
import { dateLabel, mergeMessages, relativeTime } from "../lib/chat-data";

function ChatRoom({ chatId, user }) {
  const { socket, connected, request, emit, refreshInbox } = useChat();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [state, setState] = useState("loading");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selling, setSelling] = useState(false);
  const latest = useRef([]);
  const typingSentAt = useRef(0);
  const stopTimer = useRef(null);
  const hideTimer = useRef(null);
  const bottom = useRef(null);
  const active = useRef(false);

  useEffect(() => { latest.current = messages; }, [messages]);

  useEffect(() => {
    active.current = true;
    let live = true;
    let loaded = false;
    let entered = false;
    let listingRevision = 0;
    let synchronization = 0;
    const controller = new AbortController();
    const read = async () => {
      if (!live || !socket?.connected) return;
      try { await emit("chat:read", { chatId }); }
      catch (problem) { if (live) setNotice(problem.message); }
    };
    async function sync() {
      const sequence = ++synchronization;
      let cursor = loaded ? latest.current.filter((item) => item.id).at(-1)?.id : null;
      try {
        if (socket?.connected) {
          await emit("chat:join", { chatId });
          entered = true;
          if (!live) { void emit("chat:leave", { chatId }).catch(() => {}); return; }
        }
        const detailRevision = listingRevision;
        const detail = await request(`/chats/${chatId}`, { signal: controller.signal });
        if (!live || sequence !== synchronization) return;
        setConversation((previous) => listingRevision !== detailRevision && previous ? { ...detail.data, shoe: previous.shoe } : detail.data);
        const incoming = [];
        let result;
        do {
          result = await request(`/chats/${chatId}/messages?limit=30${cursor ? `&after=${cursor}` : ""}`, { signal: controller.signal });
          incoming.push(...result.data);
          if (!live || sequence !== synchronization) return;
          if (!loaded || !cursor || !result.meta.hasMore) break;
          cursor = result.meta.nextCursor;
        } while (cursor);
        if (loaded) {
          const recent = await request(`/chats/${chatId}/messages?limit=30`, { signal: controller.signal });
          if (!live || sequence !== synchronization) return;
          incoming.push(...recent.data);
        }
        if (!loaded) setHistory(result.meta);
        setMessages((previous) => mergeMessages(previous, incoming));
        setState("content");
        if (!loaded) requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: "nearest" }));
        loaded = true;
        await read();
        void refreshInbox();
      } catch (problem) {
        if (!live || axios.isCancel(problem) || sequence !== synchronization) return;
        setState(problem.response?.status === 404 || problem.code === "FORBIDDEN" ? "missing" : "error");
        setNotice(problem.response?.data?.error?.message || problem.message || "Percakapan belum bisa dimuat.");
      }
    }
    function onMessage(message) {
      if (message.chatId !== chatId) return;
      setMessages((previous) => mergeMessages(previous, [{ ...message, status: "sent" }]));
      if (message.senderId !== user.id) void read();
      setTyping(false);
      requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: "nearest" }));
    }
    function onTyping(payload) {
      if (payload.chatId !== chatId || payload.userId === user.id) return;
      setTyping(payload.isTyping);
      clearTimeout(hideTimer.current);
      if (payload.isTyping) hideTimer.current = setTimeout(() => setTyping(false), 3000);
    }
    function onRead({ chatId: id, readerId, lastReadMessageId }) {
      if (id !== chatId || readerId === user.id) return;
      setMessages((previous) => {
        const cursor = previous.findIndex((item) => item.id === lastReadMessageId);
        return previous.map((item, index) => item.id && item.senderId === user.id && (!lastReadMessageId || (cursor >= 0 && index <= cursor)) ? { ...item, readAt: item.readAt || new Date().toISOString() } : item);
      });
    }
    function onListing({ shoeId, status, deletedAt }) {
      listingRevision += 1;
      setConversation((previous) => previous?.shoe.id === shoeId ? { ...previous, shoe: { ...previous.shoe, ...(status ? { status } : {}), ...(deletedAt ? { isDeleted: true } : {}) } } : previous);
    }
    function onDisconnect() { setTyping(false); clearTimeout(hideTimer.current); }
    const listeners = { connect: sync, "message:new": onMessage, "typing:update": onTyping, "chat:read:updated": onRead, "listing:status": onListing, "listing:deleted": onListing, disconnect: onDisconnect };
    if (socket) Object.entries(listeners).forEach(([name, handler]) => socket.on(name, handler));
    const startTimer = setTimeout(() => { void sync(); }, 0);
    return () => {
      live = false;
      active.current = false;
      controller.abort();
      clearTimeout(startTimer);
      clearTimeout(stopTimer.current);
      clearTimeout(hideTimer.current);
      if (socket) Object.entries(listeners).forEach(([name, handler]) => socket.off(name, handler));
      if (socket?.connected && entered) {
        void emit("typing:stop", { chatId }).catch(() => {});
        void emit("chat:leave", { chatId }).catch(() => {});
      }
    };
  }, [chatId, user.id, socket, request, emit, refreshInbox, attempt]);

  function stopTyping() {
    clearTimeout(stopTimer.current);
    typingSentAt.current = 0;
    if (socket?.connected) void emit("typing:stop", { chatId }).catch((problem) => { if (active.current) setNotice(problem.message); });
  }

  function changeText(value) {
    setText(value);
    clearTimeout(stopTimer.current);
    if (!value.trim()) { stopTyping(); return; }
    if (socket?.connected && Date.now() - typingSentAt.current >= 1500) {
      typingSentAt.current = Date.now();
      void emit("typing:start", { chatId }).catch((problem) => { if (active.current) setNotice(problem.message); });
    }
    stopTimer.current = setTimeout(stopTyping, 2000);
  }

  async function send(message) {
    setMessages((previous) => mergeMessages(previous, [{ ...message, status: "sending", error: "" }]));
    stopTyping();
    try {
      const result = await emit("message:send", { chatId, clientMessageId: message.clientMessageId, text: message.text });
      if (!active.current) return;
      setMessages((previous) => mergeMessages(previous, [{ ...result.message, status: "sent" }]));
      setNotice("");
    } catch (problem) {
      if (!active.current) return;
      setMessages((previous) => previous.map((item) => item.clientMessageId === message.clientMessageId && !item.id ? { ...item, status: "failed", error: problem.message } : item));
      if (problem.code === "SHOE_DELETED") setConversation((previous) => ({ ...previous, shoe: { ...previous.shoe, isDeleted: true } }));
      setNotice(problem.message);
    }
  }

  function submit(event) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 2000 || conversation?.shoe.isDeleted) return;
    const message = { chatId, senderId: user.id, clientMessageId: crypto.randomUUID(), text: trimmed, createdAt: new Date().toISOString(), readAt: null };
    setText("");
    void send(message);
    requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: "nearest" }));
  }

  async function loadOlder() {
    setLoadingHistory(true);
    try {
      const result = await request(`/chats/${chatId}/messages?limit=30&before=${history.nextCursor}`);
      if (!active.current) return;
      setMessages((previous) => mergeMessages(previous, result.data));
      setHistory(result.meta);
    } catch (problem) { if (active.current) setNotice(problem.response?.data?.error?.message || "Pesan lama belum bisa dimuat."); }
    finally { if (active.current) setLoadingHistory(false); }
  }

  async function markSold() {
    setSelling(true);
    try {
      await request(`/shoes/${conversation.shoe.id}/status`, { method: "PATCH", data: { status: "sold" } });
      if (!active.current) return;
      setConversation((previous) => ({ ...previous, shoe: { ...previous.shoe, status: "sold" } }));
      void refreshInbox();
      setNotice("");
    } catch (problem) { if (active.current) setNotice(problem.response?.data?.error?.message || "Status belum bisa diubah."); }
    finally { if (active.current) setSelling(false); }
  }

  if (state === "loading") return <ViewState state="loading" />;
  if (state === "missing") return <div className="chat-placeholder"><h2>Percakapan tidak ditemukan.</h2><Link to="/chats">Kembali ke inbox</Link></div>;
  if (state === "error") return <div><ViewState state="error" onReset={() => setAttempt((value) => value + 1)} /><p role="alert">{notice}</p></div>;
  const { shoe, otherParticipant } = conversation;
  const sellerView = conversation.seller.id === user.id;
  return <div className="chat-window">
    <div className="chat-header"><Link className="chat-back" to="/chats" aria-label="Kembali ke inbox">←</Link><span className="avatar">{otherParticipant.name.charAt(0)}</span><div><h3>{otherParticipant.name}</h3><span>{sellerView ? "Calon pembeli" : "Penjual"}</span></div></div>
    {!connected && <div className="chat-state-banner" role="status">Menghubungkan ulang…</div>}
    <div className="chat-product"><img src={shoe.imgUrl1} alt={shoeName(shoe)} /><div><small>Listing yang dibahas</small>{shoe.isDeleted ? <strong>{shoeName(shoe)}</strong> : <Link to={`/shoes/${shoe.id}`}><strong>{shoeName(shoe)} ↗</strong></Link>}</div><span className={`status-label ${shoe.status}`}>{shoe.isDeleted ? "Dihapus" : shoe.status === "sold" ? "Terjual" : "Tersedia"}</span></div>
    {shoe.isDeleted ? <div className="chat-state-banner">Listing telah dihapus. Riwayat masih bisa dibaca, pesan baru tidak tersedia.</div> : shoe.status === "sold" ? <div className="chat-state-banner">Sepatu sudah terjual. Percakapan tetap tersedia untuk koordinasi.</div> : sellerView && <div className="chat-deal"><span>Sudah sepakat dengan pembeli?</span><button className="button outline" disabled={selling} onClick={markSold}>{selling ? "Menyimpan…" : "Tandai terjual"}</button></div>}
    <div className="messages">
      {history?.hasMore && <button className="button outline" disabled={loadingHistory} onClick={loadOlder}>{loadingHistory ? "Memuat…" : "Muat pesan lama"}</button>}
      {!messages.length && <p>Belum ada pesan. Mulai percakapanmu.</p>}
      {messages.map((message, index) => <Fragment key={message.id || message.clientMessageId}>
        {(index === 0 || dateLabel(messages[index - 1].createdAt) !== dateLabel(message.createdAt)) && <span className="date-separator">{dateLabel(message.createdAt)}</span>}
        <div className={`message ${message.senderId === user.id ? "me" : "them"} ${message.status || "sent"}`}><p>{message.text}</p><span>{new Date(message.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}{message.senderId === user.id && ` · ${message.status === "sending" ? "Mengirim…" : message.status === "failed" ? "Gagal" : message.readAt ? "Dibaca" : "Terkirim"}`}</span>{message.status === "failed" && <><small>{message.error}</small><button className="message-retry" disabled={shoe.isDeleted} onClick={() => send(message)}>Kirim ulang</button></>}</div>
      </Fragment>)}
      {typing && <span className="typing-preview">{otherParticipant.name.split(" ")[0]} sedang mengetik…</span>}<div ref={bottom} />
    </div>
    <form className="chat-composer" onSubmit={submit}><input disabled={shoe.isDeleted} aria-label="Tulis pesan" placeholder={shoe.isDeleted ? "Percakapan ini hanya bisa dibaca" : "Tulis pesan…"} value={text} onChange={(event) => changeText(event.target.value)} maxLength={2000} required /><button disabled={shoe.isDeleted || !text.trim()} className="button dark" aria-label="Kirim pesan"><Icon name="arrow" /></button></form>
    {notice && <p className="chat-notice" role="alert">{notice}</p>}
  </div>;
}

export default function Chat({ user }) {
  const { chatId } = useParams();
  const { chats, inboxState, error, refreshInbox, connected } = useChat();
  const [search, setSearch] = useState("");
  const filtered = chats.filter((item) => `${item.otherParticipant.name} ${shoeName(item.shoe)}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="chat-page">
    <div className="page-heading"><span className="eyebrow">INBOX</span><h1>Obrolan sepatumu.</h1><p>Negosiasi harga, tanya kondisi, dan rencanakan COD dengan pembeli atau penjual.</p></div>
    {!connected && <div className="chat-state-banner" role="status">Menghubungkan ulang…</div>}
    <div className={`chat-layout ${chatId ? "room-open" : "inbox-open"}`}>
      <aside className="chat-sidebar"><div className="inbox-title"><h2>Pesan</h2><span>{chats.length}</span></div><div className="search-box"><Icon name="search" size={18} /><input aria-label="Cari percakapan" placeholder="Cari nama atau sepatu…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        {inboxState === "loading" ? <ViewState state="loading" /> : inboxState === "error" ? <><ViewState state="error" onReset={refreshInbox} /><p role="alert">{error}</p></> : !chats.length ? <ViewState state="empty" title="Belum ada percakapan." /> : <div className="conversation-list">{filtered.map((item) => <Link key={item.id} className={`conversation ${item.id === chatId ? "selected" : ""}`} to={`/chats/${item.id}`}><span className="avatar">{item.otherParticipant.name.charAt(0)}</span><span className="conversation-copy"><strong>{item.otherParticipant.name}</strong><span>{shoeName(item.shoe)}{item.shoe.isDeleted && " · Arsip"}</span><p>{item.lastMessage?.text || "Mulai percakapan"}</p></span><span className="conversation-end"><small>{relativeTime(item.lastMessageAt)}</small>{item.unreadCount > 0 && <b className="unread-badge">{item.unreadCount}</b>}</span></Link>)}{!filtered.length && <p className="inbox-empty">Tidak ada percakapan yang cocok.</p>}</div>}
        <div className="sidebar-note"><Icon name="chat" /><p>Diskusikan kondisi sepatu dan rencana COD melalui chat.</p></div>
      </aside>
      {chatId ? <ChatRoom key={chatId} chatId={chatId} user={user} /> : <div className="chat-placeholder"><Icon name="chat" size={38} /><h2>Pilih percakapan.</h2><p>Detail sepatu dan riwayat obrolan tampil di sini.</p></div>}
    </div>
  </section>;
}
