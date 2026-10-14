import { useState } from "react";
import { Link } from "react-router";
import Icon from "../components/Icon";
import ProductCard from "../components/ProductCard";
import AISearchPreview from "../components/AISearchPreview";
import ViewState from "../components/ViewState";
import { products, categories, shoeName } from "../data/products";

const brands = ["Semua", "Nike", "Adidas", "New Balance", "Converse"];
const sizes = ["40", "40.5", "41", "42", "42.5", "43"];

export default function Home() {
  const [brand, setBrand] = useState("Semua");
  const [size, setSize] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [category, setCategory] = useState("");
  const [available, setAvailable] = useState(false);
  const [page, setPage] = useState(1);
  const [view, setView] = useState("content");

  const filtered = products
    .filter((product) =>
      (brand === "Semua" || product.brand === brand) &&
      (!size || String(product.size) === size) &&
      (!category || product.category === category) &&
      (!available || product.status === "available") &&
      shoeName(product).toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
    });

  function resetFilters() {
    setBrand("Semua");
    setSize("");
    setSearch("");
    setCategory("");
    setAvailable(false);
    setPage(1);
    setView("content");
  }
  const totalPages = Math.ceil(filtered.length / 3);
  const visibleProducts = filtered.slice((page - 1) * 3, page * 3);

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
          <img src={products[0].imgUrl1} alt="Koleksi sepatu preloved Sole Swap" />
          <span className="visual-caption">THE PRELOVED COLLECTION</span>
        </div>
      </section>

      <AISearchPreview />

      <section className="catalog" id="explore">
        <div className="section-heading">
          <div><h2>SEPATU PRELOVED</h2><p>Nike, Adidas, New Balance, dan lainnya. Pilih yang cocok buat kamu.</p></div>
          <Link to="/my-shoes/add" className="text-link">Jual sepatu <Icon name="plus" size={17} /></Link>
        </div>

        <div className="catalog-layout">
          <aside className="catalog-sidebar" aria-label="Filter sepatu">
            <div className="filter-heading"><h3>FILTER</h3><button onClick={resetFilters}>Reset</button></div>
            <div className="filter-group">
              <h4>Merek</h4>
              {brands.map((item) => (
                <label className="brand-option" key={item}>
                  <input type="radio" name="brand" checked={brand === item} onChange={() => { setBrand(item); setPage(1); }} />
                  <span>{item === "Semua" ? "Semua merek" : item}</span>
                  <small>{products.filter((product) => item === "Semua" || product.brand === item).length}</small>
                </label>
              ))}
            </div>
            <div className="filter-group">
              <h4>Ukuran (EU)</h4>
              <div className="size-options">
                {sizes.map((item) => <button key={item} className={size === item ? "active" : ""} aria-pressed={size === item} onClick={() => { setSize(size === item ? "" : item); setPage(1); }}>{item}</button>)}
              </div>
            </div>
            <div className="filter-group"><h4>Kategori</h4><select className="filter-select" aria-label="Kategori sepatu" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="">Semua kategori</option>{Object.entries(categories).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
            <label className="brand-option"><input type="checkbox" checked={available} onChange={(event) => { setAvailable(event.target.checked); setPage(1); }} />Tersedia saja</label>
            <p className="filter-note">Detail kondisi tertera di setiap produk. Hubungi penjual untuk foto tambahan.</p>
          </aside>

          <div className="catalog-content">
            <div className="catalog-toolbar">
              <div className="search-box"><Icon name="search" size={18} /><input aria-label="Cari sepatu" placeholder="Cari nama sepatu…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
              <label className="sort-label">Urutkan <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="newest">Terbaru</option><option value="price_asc">Harga terendah</option><option value="price_desc">Harga tertinggi</option></select></label>
            </div>
            <div className="results-row"><span>{filtered.length} produk{brand !== "Semua" && ` · ${brand}`}{size && ` · EU ${size}`}</span><label className="state-select">Preview state <select value={view} onChange={(event) => setView(event.target.value)}><option value="content">Normal</option><option value="loading">Loading</option><option value="empty">Kosong</option><option value="error">Error</option></select></label></div>
            {view === "content" ? <><div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>
            {!filtered.length && <ViewState state="empty" title="Tidak ada sepatu yang cocok." onReset={resetFilters} />}
            {totalPages > 1 && <nav className="pagination" aria-label="Halaman katalog"><button disabled={page === 1} onClick={() => setPage(page - 1)}>←</button>{Array.from({ length: totalPages }, (_, index) => <button key={index} aria-current={page === index + 1 ? "page" : undefined} onClick={() => setPage(index + 1)}>{index + 1}</button>)}<button disabled={page === totalPages} onClick={() => setPage(page + 1)}>→</button></nav>}</> : <ViewState state={view} onReset={() => setView("content")} />}
          </div>
        </div>
      </section>

      <section className="sell-banner">
        <div><h2>PUNYA SEPATU YANG JARANG DIPAKAI?</h2><p>Pasang foto dan detailnya. Temukan pembeli di Sole Swap.</p></div>
        <Link to="/my-shoes/add" className="button dark">Jual sekarang <Icon name="arrow" size={18} /></Link>
      </section>
    </div>
  );
}
