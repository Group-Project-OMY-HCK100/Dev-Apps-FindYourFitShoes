import { useState } from "react";
import { Link } from "react-router";
import { previewUser, products, shoeName, conditions, formatPrice } from "../data/products";
import ViewState from "../components/ViewState";
import Icon from "../components/Icon";
import ConfirmDialog from "../components/ConfirmDialog";

export default function MyShoes() {
  const user = previewUser;
  const [status, setStatus] = useState("all");
  const [view, setView] = useState("content");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState(null);
  const mine = products.filter((shoe) => shoe.seller.id === user.id);
  const filtered = mine.filter((shoe) => status === "all" || shoe.status === status);
  return <section className="form-page">
    <div className="page-heading page-heading-actions"><div><span className="eyebrow">KOLEKSI SAYA</span><h1>My Shoes</h1><p>Kelola listing, perbarui detail, dan tandai sepatu yang sudah terjual.</p></div><Link className="button dark" to="/my-shoes/add"><Icon name="plus" size={18} />Jual sepatu</Link></div>
    <div className="listing-summary"><div><strong>{mine.length}</strong><span>Total listing</span></div><div><strong>{mine.filter((shoe) => shoe.status === "available").length}</strong><span>Tersedia</span></div><div><strong>{mine.filter((shoe) => shoe.status === "sold").length}</strong><span>Terjual</span></div></div>
    <div className="management-toolbar"><div className="tabs">{[["all", "Semua"], ["available", "Tersedia"], ["sold", "Terjual"]].map(([value, label]) => <button className={status === value ? "active" : ""} key={value} onClick={() => setStatus(value)}>{label}</button>)}</div><label className="state-select">Preview state<select value={view} onChange={(event) => setView(event.target.value)}><option value="content">Normal</option><option value="loading">Loading</option><option value="empty">Kosong</option><option value="error">Error</option></select></label></div>
    {notice && <p className="notice" role="status">{notice}</p>}
    {view === "content" && filtered.length ? <div className="my-listings">{filtered.map((shoe) => <article className="my-listing" key={shoe.id}><Link to={`/shoes/${shoe.id}`}><img src={shoe.imgUrl1} alt={shoeName(shoe)} /></Link><div className="my-listing-copy"><span className={`status-label ${shoe.status}`}>{shoe.status === "sold" ? "Terjual" : "Tersedia"}</span><h2><Link to={`/shoes/${shoe.id}`}>{shoeName(shoe)}</Link></h2><p>EU {shoe.size} · {conditions[shoe.condition]}</p><strong>{formatPrice(shoe.price)}</strong></div><div className="listing-actions"><Link className="button outline" to={`/my-shoes/${shoe.id}/edit`}>Edit listing</Link><button className="plain-button" onClick={() => setNotice(`Preview: status ${shoeName(shoe)} akan diubah menjadi ${shoe.status === "sold" ? "tersedia" : "terjual"}. Data contoh tidak diubah.`)}>{shoe.status === "sold" ? "Jadikan tersedia" : "Tandai terjual"}</button><button className="plain-button muted" onClick={() => setDeleting(shoe)}>Hapus listing</button></div></article>)}</div> : <ViewState state={view === "content" ? "empty" : view} title="Belum ada listing di sini." onReset={() => { setView("content"); setStatus("all"); }} />}
    {deleting && <ConfirmDialog title="Hapus listing ini?" description={`${shoeName(deleting)} akan hilang dari katalog. Riwayat chat tetap ada, tetapi tidak dapat menerima pesan baru.`} onCancel={() => setDeleting(null)} onConfirm={() => { setNotice("Preview penghapusan selesai. Data contoh tidak dihapus."); setDeleting(null); }} />}
  </section>;
}
