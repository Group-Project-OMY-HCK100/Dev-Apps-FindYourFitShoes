import { useState } from "react";
import { Link, useParams } from "react-router";
import Icon from "../components/Icon";
import ViewState from "../components/ViewState";
import { chats } from "../data/chats";
import { previewUser, shoeName } from "../data/products";

function ChatRoom({ conversation }) {
  const [notice, setNotice] = useState("");
  const { shoe, otherParticipant } = conversation;
  const sellerView = conversation.seller.id === previewUser.id;
  return <div className="chat-window">
    <div className="chat-header"><Link className="chat-back" to="/chats" aria-label="Kembali ke inbox">←</Link><span className="avatar">{otherParticipant.name.charAt(0)}</span><div><h3>{otherParticipant.name}</h3><span>{sellerView ? "Calon pembeli" : "Penjual"} · Percakapan contoh</span></div><span className="demo-badge">PREVIEW</span></div>
    <div className="chat-product"><img src={shoe.imgUrl1} alt={shoeName(shoe)} /><div><small>Listing yang dibahas</small>{shoe.isDeleted ? <strong>{shoeName(shoe)}</strong> : <Link to={`/shoes/${shoe.id}`}><strong>{shoeName(shoe)} ↗</strong></Link>}</div><span className={`status-label ${shoe.status}`}>{shoe.isDeleted ? "Dihapus" : shoe.status === "sold" ? "Terjual" : "Tersedia"}</span></div>
    {shoe.isDeleted ? <div className="chat-state-banner">Listing telah dihapus. Riwayat masih bisa dibaca, pesan baru tidak tersedia.</div> : shoe.status === "sold" ? <div className="chat-state-banner">Sepatu sudah terjual. Percakapan lama tetap tersedia untuk koordinasi.</div> : sellerView && <div className="chat-deal"><span>Sudah sepakat dengan pembeli?</span><button className="button outline" onClick={() => setNotice("Preview tombol tandai terjual. Status contoh tidak diubah.")}>Tandai terjual</button></div>}
    <div className="messages"><span className="date-separator">Hari ini</span>{conversation.messages.map((message) => <div key={message.id} className={`message ${message.senderId === previewUser.id ? "me" : "them"}`}><p>{message.text}</p><span>{message.time}</span></div>)}{!shoe.isDeleted && <span className="typing-preview">Contoh indikator: {otherParticipant.name.split(" ")[0]} sedang mengetik…</span>}</div>
    <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); setNotice("Ini hanya tampilan chat. Pesan tidak dikirim dan fitur socket belum dipasang."); }}><input disabled={shoe.isDeleted} aria-label="Tulis pesan" placeholder={shoe.isDeleted ? "Percakapan ini hanya bisa dibaca" : "Tulis pesan…"} required /><button disabled={shoe.isDeleted} className="button dark" aria-label="Preview kirim pesan"><Icon name="arrow" /></button></form>
    {notice && <p className="chat-notice" role="status">{notice}</p>}
  </div>;
}

export default function Chat() {
  const { chatId } = useParams();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("content");
  const conversation = chats.find((item) => item.id === chatId);
  const filtered = chats.filter((item) => `${item.otherParticipant.name} ${shoeName(item.shoe)}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="chat-page">
    <div className="page-heading"><span className="eyebrow">INBOX · CONTOH AKUN RAKA</span><h1>Obrolan sepatumu.</h1><p>Negosiasi harga, tanya kondisi, dan rencanakan COD dengan pembeli atau penjual.</p></div>
    <div className="management-toolbar"><p className="demo-help">Contoh percakapan sebagai pembeli, penjual, dan arsip listing.</p><label className="state-select">Preview inbox<select value={view} onChange={(event) => setView(event.target.value)}><option value="content">Normal</option><option value="loading">Loading</option><option value="empty">Kosong</option><option value="error">Error</option></select></label></div>
    {view !== "content" ? <ViewState state={view} title="Belum ada percakapan." onReset={() => setView("content")} /> : <div className={`chat-layout ${chatId ? "room-open" : "inbox-open"}`}>
      <aside className="chat-sidebar"><div className="inbox-title"><h2>Pesan</h2><span>{chats.length}</span></div><div className="search-box"><Icon name="search" size={18} /><input aria-label="Cari percakapan" placeholder="Cari nama atau sepatu…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="conversation-list">{filtered.map((item) => <Link key={item.id} className={`conversation ${item.id === chatId ? "selected" : ""}`} to={`/chats/${item.id}`}><span className="avatar">{item.otherParticipant.name.charAt(0)}</span><span className="conversation-copy"><strong>{item.otherParticipant.name}</strong><span>{shoeName(item.shoe)}{item.shoe.isDeleted && " · Arsip"}</span><p>{item.messages.at(-1).text}</p></span><span className="conversation-end"><small>10.32</small>{item.unreadCount > 0 && <b className="unread-badge">{item.unreadCount}</b>}</span></Link>)}</div>{!filtered.length && <p className="inbox-empty">Tidak ada percakapan yang cocok.</p>}<div className="sidebar-note"><Icon name="chat" /><p>Riwayat contoh saja.<br />Socket belum dihubungkan.</p></div></aside>
      {conversation ? <ChatRoom key={conversation.id} conversation={conversation} /> : <div className="chat-placeholder"><Icon name="chat" size={38} /><h2>{chatId ? "Percakapan tidak ditemukan." : "Pilih percakapan."}</h2><p>{chatId ? "Buka percakapan contoh lainnya dari inbox." : "Detail sepatu dan riwayat obrolan tampil di sini."}</p><Link to="/chats" className="text-link">Lihat inbox →</Link></div>}
    </div>}
  </section>;
}
