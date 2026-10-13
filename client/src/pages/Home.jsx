import { useState } from "react";
import { Link } from "react-router";
import Icon from "../components/Icon";
import ProductCard from "../components/ProductCard";
import { products } from "../data/products";

const brands = ["Semua", "Nike", "Adidas", "New Balance", "Converse"];
const sizes = ["40", "41", "42", "43"];

export default function Home() {
  const [brand, setBrand] = useState("Semua");
  const [size, setSize] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("latest");

  const filtered = products
    .filter((product) =>
      (brand === "Semua" || product.brand === brand) &&
      (!size || product.size === size) &&
      product.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === "low") return a.price - b.price;
      if (sort === "high") return b.price - a.price;
      return a.id - b.id;
    });

  function resetFilters() {
    setBrand("Semua");
    setSize("");
    setSearch("");
  }

  return (
    <div className="home">
      <div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><span>Sepatu preloved</span></div>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">SOLE SWAP / PRELOVED MARKETPLACE</span>
          <h1>SEPATU PILIHAN.<br />HARGA LEBIH RINGAN.</h1>
          <p>Cari sneakers favoritmu dari penjual lain. Cek kondisi, pilih ukuran, lalu ngobrol langsung sebelum membeli.</p>
          <a href="#explore" className="button light">Lihat koleksi <Icon name="arrow" size={18} /></a>
        </div>
        <div className="hero-visual">
          <img src={products[0].image} alt="Koleksi sepatu preloved Sole Swap" />
          <span className="visual-caption">THE PRELOVED COLLECTION</span>
        </div>
      </section>

      <section className="catalog" id="explore">
        <div className="section-heading">
          <div><h2>SEPATU PRELOVED</h2><p>Nike, Adidas, New Balance, dan lainnya. Pilih yang cocok buat kamu.</p></div>
          <Link to="/addproduct" className="text-link">Jual sepatu <Icon name="plus" size={17} /></Link>
        </div>

        <div className="catalog-layout">
          <aside className="catalog-sidebar" aria-label="Filter sepatu">
            <div className="filter-heading"><h3>FILTER</h3><button onClick={resetFilters}>Reset</button></div>
            <div className="filter-group">
              <h4>Merek</h4>
              {brands.map((item) => (
                <label className="brand-option" key={item}>
                  <input type="radio" name="brand" checked={brand === item} onChange={() => setBrand(item)} />
                  <span>{item === "Semua" ? "Semua merek" : item}</span>
                  <small>{products.filter((product) => item === "Semua" || product.brand === item).length}</small>
                </label>
              ))}
            </div>
            <div className="filter-group">
              <h4>Ukuran (EU)</h4>
              <div className="size-options">
                {sizes.map((item) => <button key={item} className={size === item ? "active" : ""} aria-pressed={size === item} onClick={() => setSize(size === item ? "" : item)}>{item}</button>)}
              </div>
            </div>
            <p className="filter-note">Detail kondisi tertera di setiap produk. Hubungi penjual untuk foto tambahan.</p>
          </aside>

          <div className="catalog-content">
            <div className="catalog-toolbar">
              <div className="search-box"><Icon name="search" size={18} /><input aria-label="Cari sepatu" placeholder="Cari nama sepatu…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
              <label className="sort-label">Urutkan <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="latest">Terbaru</option><option value="low">Harga terendah</option><option value="high">Harga tertinggi</option></select></label>
            </div>
            <div className="results-row"><span>{filtered.length} produk{brand !== "Semua" && ` · ${brand}`}{size && ` · EU ${size}`}</span><small>Koleksi contoh</small></div>
            <div className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} />)}</div>
            {!filtered.length && <div className="empty-state"><p>Tidak ada sepatu yang sesuai dengan filter kamu.</p><button className="button dark" onClick={resetFilters}>Reset filter</button></div>}
          </div>
        </div>
      </section>

      <section className="sell-banner">
        <div><h2>PUNYA SEPATU YANG JARANG DIPAKAI?</h2><p>Pasang foto dan detailnya. Temukan pembeli di Sole Swap.</p></div>
        <Link to="/addproduct" className="button dark">Jual sekarang <Icon name="arrow" size={18} /></Link>
      </section>
    </div>
  );
}
