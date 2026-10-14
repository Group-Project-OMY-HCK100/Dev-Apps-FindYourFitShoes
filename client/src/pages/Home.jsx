import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import axios from "axios";
import baseUrl from "../constants/baseUrl";
import Icon from "../components/Icon";
import ProductCard from "../components/ProductCard";

export default function Home() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [searchError, setSearchError] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const searchRequest = useRef(null);
  const searchBusy = useRef(false);

  useEffect(() => () => searchRequest.current?.abort(), []);

  async function searchShoes(query) {
    const text = query.trim();
    if (searchBusy.current) return;
    if (text.length < 3 || text.length > 300) {
      setSearchError("Masukkan pencarian sepanjang 3–300 karakter.");
      return;
    }
    searchBusy.current = true;
    setSearchError("");
    setAiQuery(text);
    setAiResult(null);
    setAiLoading(true);
    setSort("newest");
    const controller = new AbortController();
    searchRequest.current = controller;

    try {
      const { data } = await axios.post(`${baseUrl}/ai/search`, { query: text, limit: 12 }, {
        signal: controller.signal,
        timeout: 20000,
      });
      if (controller.signal.aborted) return;
      setAiResult({ data: data.data });
    } catch (error) {
      if (axios.isCancel(error)) return;
      const details = error.response?.data?.error?.details;
      setAiResult({ error: details?.length ? details.map((detail) => detail.message).join(". ") : error.response?.data?.error?.message || "Pencarian belum bisa dilakukan. Periksa koneksi lalu coba lagi." });
    } finally {
      if (searchRequest.current === controller) {
        searchBusy.current = false;
        if (!controller.signal.aborted) setAiLoading(false);
      }
    }
  }

  function backToCatalog() {
    searchRequest.current?.abort();
    searchRequest.current = null;
    searchBusy.current = false;
    setAiQuery("");
    setAiResult(null);
    setAiLoading(false);
    setSearch("");
    setSearchError("");
    setResult(null);
    setPage(1);
  }
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (aiQuery) return;
    const controller = new AbortController();

    async function getShoes() {
      try {
        const { data } = await axios.get(`${baseUrl}/shoes`, {
          params: { page, limit: 12, sort, status: "all" },
          signal: controller.signal,
          timeout: 15000,
        });

        if (controller.signal.aborted) return;
        setResult({ page, sort, attempt, shoes: data.data, meta: data.meta });
      } catch (error) {
        if (axios.isCancel(error)) return;
        setResult({
          page,
          sort,
          attempt,
          error: error.response?.data?.error?.message || "Koleksi belum bisa dimuat. Periksa koneksi atau coba lagi sebentar.",
        });
      }
    }

    getShoes();
    return () => controller.abort();
  }, [page, sort, attempt, aiQuery]);

  const current = result?.page === page && result.sort === sort && result.attempt === attempt ? result : null;
  const aiEntries = [...(aiResult?.data?.results || [])];
  if (sort === "price_asc") aiEntries.sort((a, b) => a.shoe.price - b.shoe.price);
  if (sort === "price_desc") aiEntries.sort((a, b) => b.shoe.price - a.shoe.price);
  const shoes = aiQuery ? aiEntries.map((entry) => entry.shoe) : current?.shoes || [];
  const meta = aiQuery ? aiResult?.data?.meta : current?.meta;
  const loading = aiQuery ? aiLoading : !current;
  const error = aiQuery ? aiResult?.error : current?.error;

  return (
    <div className="home">
      <div className="breadcrumbs"><span>Home</span><span>/</span><span>Sepatu preloved</span></div>

      <section className="home-hero home-hero-photo">
        <div className="home-hero-main">
          <div className="home-hero-copy">
            <span className="eyebrow">SOLE SWAP / THE PRELOVED MARKETPLACE</span>
            <h1>SEPATU BAGUS.<br />GA HARUS BARU.</h1>
            <p>Temukan koleksi sepatu dari sesama pengguna. Pilih pasanganmu, cek kondisinya, lalu ngobrol langsung dengan penjual.</p>
          </div>
          <div className="home-hero-mens">
            <img src="/images/mens-landscape-hero.jpg" alt="Model cowok dengan sneakers putih dalam foto fashion landscape" width={1920} height={960} fetchPriority="high" />
          </div>
        </div>
        <div className="home-hero-womens">
          <img src="/images/sneaker-hero.jpg" alt="Model cewek memakai sneakers hitam putih di tangga" width={1200} height={1190} />
        </div>
      </section>

      <div className="home-notes">
        <span><Icon name="shoe" size={17} />Beragam merek & ukuran</span>
        <span><Icon name="chat" size={17} />Langsung dengan penjual</span>
        <span><Icon name="arrow" size={17} />Negosiasi & COD lewat chat</span>
      </div>

      <section className="catalog home-catalog" id="explore" aria-busy={loading}>
        <div className="home-ai-panel">
          <div className="home-ai-intro">
            <h2>Cari sepatu yang kamu butuhkan</h2>
            <p>Ceritakan sepatu yang kamu inginkan. Kami bantu temukan yang sesuai dari koleksi yang tersedia.</p>
          </div>
          <form className="home-search" aria-busy={aiLoading} onSubmit={(event) => { event.preventDefault(); searchShoes(search); }}>
            <label htmlFor="shoe-search">Deskripsikan sepatu pilihanmu</label>
            <div className="home-search-input">
              <span className={`home-search-ai-icon ${aiLoading ? "is-searching" : ""}`} aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="10" cy="14" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="m15 19 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path className="ai-search-sparkle" d="M20 1c0 4-2 6-6 6 4 0 6 2 6 6 0-4 2-6 6-6-4 0-6-2-6-6Z" fill="currentColor" />
                </svg>
              </span>
              <input id="shoe-search" value={search} onChange={(event) => { setSearch(event.target.value); setSearchError(""); }} placeholder="Sneakers hitam, ukuran 42, di bawah 500 ribu…" minLength={3} maxLength={300} required disabled={aiLoading} aria-describedby="shoe-search-help" />
              <button className="button dark" type="submit" disabled={aiLoading}>{aiLoading ? "Mencari…" : "Cari"}<Icon name="arrow" size={17} /></button>
            </div>
            <p id="shoe-search-help">Sebutkan ukuran, warna, aktivitas, atau budget kamu.</p>
            <div className="home-search-examples">
              <span>Coba:</span>
              {["Sepatu lari di bawah 500 ribu", "Sneakers putih ukuran 42"].map((example) => <button key={example} type="button" disabled={aiLoading} onClick={() => { setSearch(example); setSearchError(""); }}>{example}</button>)}
            </div>
          </form>
          {searchError && <p className="auth-error home-ai-validation" role="alert">{searchError}</p>}
        </div>

        <div className="section-heading home-collection-heading">
          <div><h2>{aiQuery ? "HASIL PENCARIAN" : "KOLEKSI SEPATU"}</h2><p>{aiQuery ? `Hasil untuk “${aiQuery}”` : "Listing terbaru dari komunitas Sole Swap."}</p></div>
          <div className="home-collection-tools">
            {meta && !error && <span className="home-product-count">{meta.totalItems} sepatu</span>}
            <label className="home-sort" htmlFor="shoe-sort">Urutkan
              <select id="shoe-sort" disabled={aiLoading} value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
                <option value="newest">{aiQuery ? "Paling sesuai" : "Terbaru"}</option>
                <option value="price_asc">Harga terendah</option>
                <option value="price_desc">Harga tertinggi</option>
              </select>
            </label>
          </div>
        </div>
        {aiQuery && <div className="home-ai-heading"><span>{aiLoading ? "Mencari sepatu yang sesuai…" : aiResult?.data?.mode === "fallback" ? "HASIL PENCARIAN BIASA" : "PENCARIAN AI"}</span><button className="plain-button" onClick={backToCatalog}>← Kembali ke koleksi</button></div>}
        {aiResult?.data?.mode === "fallback" && <p className="home-search-notice" role="status">{aiResult.data.notice || "AI sedang tidak tersedia. Hasil menggunakan pencarian teks biasa."}</p>}
        {aiQuery && aiResult?.data && <p className="home-ai-limit">Menampilkan hingga {aiResult.data.meta.limit} hasil. {sort === "newest" ? "" : "Urutan harga berlaku pada hasil pencarian ini."}</p>}

        {loading ? (
          <div className="home-loading" role="status">
            <p>{aiQuery ? "Mencari sepatu yang sesuai…" : "Memuat koleksi sepatu…"}</p>
            <div className="home-product-grid" aria-hidden="true">
              {Array.from({ length: 8 }, (_, index) => <div className="home-skeleton" key={index}><div /><span /><span /></div>)}
            </div>
          </div>
        ) : error ? (
          <div className="home-message">
            <Icon name="shoe" size={32} />
            <h3>{aiQuery ? "Pencarian belum bisa ditampilkan." : "Koleksi belum bisa ditampilkan."}</h3>
            <p role="alert">{error}</p>
            <button className="button dark" onClick={() => aiQuery ? searchShoes(aiQuery) : setAttempt(attempt + 1)}>Coba lagi <Icon name="arrow" size={17} /></button>
          </div>
        ) : !shoes.length ? (
          <div className="home-message">
            <Icon name="shoe" size={32} />
            <h3>{aiQuery ? "Belum ada sepatu yang cocok." : page > 1 ? "Tidak ada listing di halaman ini." : "Koleksi berikutnya bisa datang dari kamu."}</h3>
            <p>{aiQuery ? "Coba ubah pencarianmu, misalnya model, ukuran, atau batas harga yang berbeda." : page > 1 ? "Kembali ke halaman pertama untuk melihat koleksi terbaru." : "Belum ada sepatu yang dipasang. Mulai dengan koleksi yang sudah jarang kamu pakai."}</p>
            {aiQuery ? <button className="button dark" onClick={backToCatalog}>Lihat semua koleksi</button> : page > 1 ? <button className="button dark" onClick={() => setPage(1)}>Lihat halaman pertama</button> : <Link to="/my-shoes/add" className="button dark">Jual sepatu <Icon name="plus" size={17} /></Link>}
          </div>
        ) : (
          <>
            <div className="product-grid home-product-grid">
              {aiQuery ? aiEntries.map((entry) => <div className="home-ai-product" key={entry.shoe.id}><ProductCard product={entry.shoe} />{aiResult.data.mode === "ai" && entry.reason && <p className="home-ai-reason">{entry.reason}</p>}</div>) : shoes.map((shoe) => <ProductCard key={shoe.id} product={shoe} />)}
            </div>
            {!aiQuery && meta.totalPages > 1 && (
              <div className="home-catalog-footer">
                <nav className="home-pagination" aria-label="Halaman koleksi">
                  <button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Halaman sebelumnya">←</button>
                  {Array.from({ length: Math.min(5, meta.totalPages) }, (_, index) => {
                    const pageNumber = Math.max(1, Math.min(page - 2, meta.totalPages - 4)) + index;
                    return <button key={pageNumber} aria-label={`Halaman ${pageNumber}`} aria-current={page === pageNumber ? "page" : undefined} onClick={() => setPage(pageNumber)}>{pageNumber}</button>;
                  })}
                  <button disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} aria-label="Halaman berikutnya">→</button>
                </nav>
              </div>
            )}
          </>
        )}
      </section>

      <section className="home-sell-banner" aria-labelledby="sell-banner-title">
        <div className="home-sell-copy">
          <span className="eyebrow">MAKE ROOM FOR YOUR NEXT PAIR</span>
          <h2 id="sell-banner-title">JARANG DIPAKAI? SAATNYA DIJUAL LAGI.</h2>
          <p>Pasang foto, jelaskan kondisi, dan temukan pemilik berikutnya.</p>
        </div>
        <Link to="/my-shoes/add" className="button dark home-sell-cta">Mulai jual <Icon name="arrow" size={18} /></Link>
      </section>
    </div>
  );
}
