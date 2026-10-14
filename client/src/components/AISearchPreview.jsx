import { useState } from "react";
import { Link } from "react-router";
import { products, shoeName, formatPrice } from "../data/products";
import Icon from "./Icon";

export default function AISearchPreview() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("idle");
  return <section className="ai-search-preview">
    <div><span className="eyebrow">CARI DENGAN BAHASA SENDIRI</span><h2>Sepatu seperti apa yang kamu cari?</h2><p>Coba “sepatu lari di bawah 500 ribu” atau “sneakers hitam ukuran 42”.</p></div>
    <form onSubmit={(event) => { event.preventDefault(); setMode("success"); }}><label className="sr-only" htmlFor="ai-query">Deskripsikan sepatu</label><input id="ai-query" minLength={3} maxLength={300} required placeholder="Tulis kebutuhanmu…" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="button dark">Cari<Icon name="arrow" size={16} /></button></form>
    {mode !== "idle" && <div className="ai-preview-results"><div className="preview-result-title"><strong>Ilustrasi hasil · bukan hasil AI sebenarnya</strong><button onClick={() => setMode(mode === "fallback" ? "success" : "fallback")}>Preview {mode === "fallback" ? "hasil AI" : "fallback"}</button></div>{mode === "fallback" ? <p className="notice">Pencarian pintar sedang tidak tersedia. Gunakan pencarian biasa di katalog.</p> : <><div className="filter-chips"><span>Running</span><span>Di bawah Rp500.000</span><span>Tersedia</span></div><Link className="ai-result" to={`/shoes/${products[4].id}`}><img src={products[4].imgUrl1} alt={shoeName(products[4])} /><div><strong>{shoeName(products[4])}</strong><p>{formatPrice(products[4].price)} · EU {products[4].size}</p><small>Contoh alasan: kategori running dan harga di bawah Rp500.000.</small></div><Icon name="arrow" size={18} /></Link></>}<button className="plain-button" onClick={() => setMode("idle")}>Tutup contoh hasil</button></div>}
  </section>;
}
