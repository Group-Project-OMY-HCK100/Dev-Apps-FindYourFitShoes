import { useEffect, useState } from "react";
import { Link } from "react-router";
import axios from "axios";
import baseUrl from "../constants/baseUrl";
import Icon from "../components/Icon";
import ProductCard from "../components/ProductCard";

export default function Home() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [searchNotice, setSearchNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function getShoes() {
      try {
        const { data } = await axios.get(`${baseUrl}/shoes`, {
          params: { page, limit: 12, sort },
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
  }, [page, sort, attempt]);

  const current = result?.page === page && result.sort === sort && result.attempt === attempt ? result : null;
  const shoes = current?.shoes || [];
  const meta = current?.meta;
  const loading = !current;

  return (
    <div className="home">
      <div className="breadcrumbs"><span>Home</span><span>/</span><span>Sepatu preloved</span></div>

      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">SOLE SWAP / THE PRELOVED MARKETPLACE</span>
          <h1>SEPATU BAGUS.<br />NGGAK HARUS BARU.</h1>
          <p>Temukan koleksi sepatu dari sesama pengguna. Pilih pasanganmu, cek kondisinya, lalu ngobrol langsung dengan penjual.</p>
          <div className="home-hero-actions">
            <a href="#explore" className="button light">Lihat koleksi <Icon name="arrow" size={18} /></a>
            <Link to="/my-shoes/add" className="home-sell-link">Jual sepatumu ↗</Link>
          </div>
        </div>
        <div className="home-hero-art" aria-hidden="true">
          <span className="home-art-caption">BUY / WEAR / REPEAT</span>
          <Icon name="shoe" size={160} />
          <strong>SECOND HAND.<br />FIRST CHOICE.</strong>
          <span className="home-art-footer">SOLE SWAP COLLECTION</span>
        </div>
      </section>

      <div className="home-notes">
        <span><Icon name="shoe" size={17} />Beragam merek & ukuran</span>
        <span><Icon name="chat" size={17} />Langsung dengan penjual</span>
        <span><Icon name="arrow" size={17} />Negosiasi & COD lewat chat</span>
      </div>

      <section className="catalog home-catalog" id="explore" aria-busy={loading}>
        <div className="section-heading">
          <div><span className="eyebrow">THE LATEST LISTINGS</span><h2>KOLEKSI SEPATU</h2><p>Listing terbaru dari komunitas Sole Swap.</p></div>
          {meta && !current?.error && <span className="home-product-count">{meta.totalItems} sepatu</span>}
        </div>

        <div className="home-catalog-controls">
          <form className="home-search" onSubmit={(event) => {
            event.preventDefault();
            setSearchNotice("Pencarian AI belum diaktifkan. Untuk sekarang kamu bisa melihat koleksi dan mengurutkan harga.");
          }}>
            <label htmlFor="shoe-search">CARI SEPATUMU</label>
            <div className="home-search-input">
              <Icon name="search" size={19} />
              <input id="shoe-search" value={search} onChange={(event) => { setSearch(event.target.value); setSearchNotice(""); }} placeholder="Contoh: sneakers hitam ukuran 42 di bawah 500 ribu" maxLength={300} required aria-describedby="shoe-search-help" />
              <button className="button dark" type="submit">Cari <Icon name="arrow" size={16} /></button>
            </div>
            <p id="shoe-search-help">Tulis model, ukuran, atau budget kamu. Pencarian AI akan tersedia pada tahap berikutnya.</p>
          </form>
          <label className="home-sort" htmlFor="shoe-sort">URUTKAN
            <select id="shoe-sort" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
              <option value="newest">Terbaru</option>
              <option value="price_asc">Harga terendah</option>
              <option value="price_desc">Harga tertinggi</option>
            </select>
          </label>
        </div>
        {searchNotice && <p className="home-search-notice" role="status">{searchNotice}</p>}

        {loading ? (
          <div className="home-loading" role="status">
            <p>Memuat koleksi sepatu…</p>
            <div className="home-product-grid" aria-hidden="true">
              {Array.from({ length: 8 }, (_, index) => <div className="home-skeleton" key={index}><div /><span /><span /></div>)}
            </div>
          </div>
        ) : current.error ? (
          <div className="home-message">
            <Icon name="shoe" size={32} />
            <h3>Koleksi belum bisa ditampilkan.</h3>
            <p role="alert">{current.error}</p>
            <button className="button dark" onClick={() => setAttempt(attempt + 1)}>Coba lagi <Icon name="arrow" size={17} /></button>
          </div>
        ) : !shoes.length ? (
          <div className="home-message">
            <Icon name="shoe" size={32} />
            <h3>{page > 1 ? "Tidak ada listing di halaman ini." : "Koleksi berikutnya bisa datang dari kamu."}</h3>
            <p>{page > 1 ? "Kembali ke halaman pertama untuk melihat koleksi terbaru." : "Belum ada sepatu yang dipasang. Mulai dengan koleksi yang sudah jarang kamu pakai."}</p>
            {page > 1 ? <button className="button dark" onClick={() => setPage(1)}>Lihat halaman pertama</button> : <Link to="/my-shoes/add" className="button dark">Jual sepatu <Icon name="plus" size={17} /></Link>}
          </div>
        ) : (
          <>
            <div className="product-grid home-product-grid">
              {shoes.map((shoe) => <ProductCard key={shoe.id} product={shoe} />)}
            </div>
            <div className="home-catalog-footer">
              <span>Menampilkan {(page - 1) * meta.limit + 1}–{(page - 1) * meta.limit + shoes.length} dari {meta.totalItems} sepatu</span>
              {meta.totalPages > 1 && (
                <nav className="home-pagination" aria-label="Halaman koleksi">
                  <button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Halaman sebelumnya">←</button>
                  <span aria-live="polite">{page} / {meta.totalPages}</span>
                  <button disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} aria-label="Halaman berikutnya">→</button>
                </nav>
              )}
            </div>
          </>
        )}
      </section>

      <section className="home-sell-banner">
        <div><span className="eyebrow">MAKE ROOM FOR YOUR NEXT PAIR</span><h2>JARANG DIPAKAI?<br />SAATNYA DIJUAL LAGI.</h2><p>Pasang foto, jelaskan kondisi, dan temukan pemilik berikutnya.</p></div>
        <Link to="/my-shoes/add" className="button dark">Mulai jual <Icon name="arrow" size={18} /></Link>
      </section>
    </div>
  );
}
