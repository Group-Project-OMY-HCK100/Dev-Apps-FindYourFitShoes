import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import axios from "axios";
import baseUrl from "../constants/baseUrl";
import { conditions } from "../data/products";
import Icon from "../components/Icon";
import ConfirmDialog from "../components/ConfirmDialog";

export default function MyShoes({ token, onUnauthorized }) {
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const mutationRequest = useRef(null);

  useEffect(() => () => mutationRequest.current?.abort(), []);

  async function changeStatus(shoe) {
    if (busy.current) return;
    busy.current = true;
    setUpdatingId(shoe.id);
    setStatusError("");
    setMessage("");
    const nextStatus = shoe.status === "sold" ? "available" : "sold";
    const controller = new AbortController();
    mutationRequest.current = controller;

    try {
      await axios.patch(`${baseUrl}/shoes/${shoe.id}/status`, { status: nextStatus }, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        timeout: 15000,
      });
      if (controller.signal.aborted) return;
      setMessage(`${shoe.brand} ${shoe.article} ${nextStatus === "sold" ? "sudah ditandai terjual" : "tersedia kembali"}.`);
      setPage(1);
      setAttempt((value) => value + 1);
    } catch (error) {
      if (axios.isCancel(error)) return;
      if (error.response?.status === 401) { onUnauthorized(); return; }
      setStatusError(error.response?.data?.error?.message || "Status belum bisa diperbarui. Muat ulang daftar untuk memastikan statusnya sebelum mencoba lagi.");
    } finally {
      busy.current = false;
      if (!controller.signal.aborted) setUpdatingId(null);
    }
  }

  async function deleteShoe() {
    if (!deleting || busy.current) return;
    busy.current = true;
    setDeletingId(deleting.id);
    setDeleteError("");
    setMessage("");
    setStatusError("");
    const controller = new AbortController();
    mutationRequest.current = controller;

    try {
      await axios.delete(`${baseUrl}/shoes/${deleting.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        timeout: 15000,
      });
      if (controller.signal.aborted) return;
      setMessage(`${deleting.brand} ${deleting.article} berhasil dihapus.`);
      setDeleting(null);
      setPage(1);
      setAttempt((value) => value + 1);
    } catch (error) {
      if (axios.isCancel(error)) return;
      if (error.response?.status === 401) { onUnauthorized(); return; }
      setDeleteError(error.response?.data?.error?.message || "Belum bisa memastikan listing terhapus. Periksa kembali daftar atau coba lagi.");
    } finally {
      busy.current = false;
      if (!controller.signal.aborted) setDeletingId(null);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    async function getMyShoes() {
      try {
        const { data } = await axios.get(`${baseUrl}/shoes/my-shoes`, {
          params: { status, page, limit: 12 },
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          timeout: 15000,
        });
        if (controller.signal.aborted) return;
        setResult({ status, page, attempt, shoes: data.data, meta: data.meta });
      } catch (error) {
        if (axios.isCancel(error)) return;
        if (error.response?.status === 401) {
          onUnauthorized();
          return;
        }
        setResult({ status, page, attempt, error: error.response?.data?.error?.message || "Listing belum bisa dimuat. Periksa koneksi lalu coba lagi." });
      }
    }

    getMyShoes();
    return () => controller.abort();
  }, [status, page, attempt, token, onUnauthorized]);

  const current = result?.status === status && result.page === page && result.attempt === attempt ? result : null;
  const shoes = current?.shoes || [];
  const meta = current?.meta;
  const loading = !current;

  return (
    <section className="form-page">
      <div className="page-heading page-heading-actions">
        <div><span className="eyebrow">KOLEKSI SAYA</span><h1>My Shoes</h1><p>Semua sepatu yang kamu pasang, dalam satu tempat.</p></div>
        <Link className="button dark" to="/my-shoes/add"><Icon name="plus" size={18} />Jual sepatu</Link>
      </div>

      <div className="management-toolbar">
        <div className="tabs" aria-label="Status listing">
          {[["all", "Semua"], ["available", "Tersedia"], ["sold", "Terjual"]].map(([value, label]) => (
            <button disabled={Boolean(updatingId || deletingId)} key={value} className={status === value ? "active" : ""} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }}>{label}</button>
          ))}
        </div>
        {meta && !current.error && <span className="demo-help">{meta.totalItems} listing{status === "available" ? " tersedia" : status === "sold" ? " terjual" : ""}</span>}
      </div>

      {message && <p className="notice" role="status">{message}</p>}
      {statusError && <p className="auth-error" role="alert">{statusError}</p>}

      {loading ? (
        <div className="loading-preview" role="status" aria-busy="true"><p>Memuat listing kamu…</p><div className="skeleton-grid" aria-hidden="true">{[1, 2, 3].map((item) => <div className="skeleton-card" key={item}><div /><span /><span /></div>)}</div></div>
      ) : current.error ? (
        <div className="empty-state compact"><h2>Listing belum bisa ditampilkan.</h2><p role="alert">{current.error}</p><button className="button dark" onClick={() => setAttempt(attempt + 1)}>Coba lagi<Icon name="arrow" size={17} /></button></div>
      ) : !shoes.length ? (
        <div className="empty-state compact">
          <h2>{page > 1 ? "Tidak ada listing di halaman ini." : status === "all" ? "Belum ada sepatu yang kamu jual." : status === "sold" ? "Belum ada listing terjual." : "Belum ada listing tersedia."}</h2>
          <p>{status === "all" ? "Mulai pasang foto dan detail sepatu yang sudah jarang kamu pakai." : "Coba lihat semua listing milikmu."}</p>
          {page > 1 || status !== "all" ? <button className="button dark" onClick={() => { setStatus("all"); setPage(1); }}>Lihat semua listing</button> : <Link className="button dark" to="/my-shoes/add">Jual sepatu pertama<Icon name="plus" size={17} /></Link>}
        </div>
      ) : (
        <>
          <div className="my-listings">
            {shoes.map((shoe) => (
              <article className="my-listing" key={shoe.id}>
                <Link to={`/shoes/${shoe.id}`} aria-label={`Lihat detail ${shoe.brand} ${shoe.article}`}><img src={shoe.imgUrl1} alt={`${shoe.brand} ${shoe.article}`} loading="lazy" /></Link>
                <div className="my-listing-copy">
                  <span className={`status-label ${shoe.status}`}>{shoe.status === "sold" ? "Terjual" : "Tersedia"}</span>
                  <h2><Link to={`/shoes/${shoe.id}`}>{shoe.brand} {shoe.article}</Link></h2>
                  <p>EU {shoe.size} · {conditions[shoe.condition] || shoe.condition}</p>
                  <strong>{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(shoe.price)}</strong>
                </div>
                <div className="listing-actions">
                  <Link className="button dark" to={`/my-shoes/${shoe.id}/edit`}>Edit listing<Icon name="arrow" size={16} /></Link>
                  <button className="button outline" disabled={Boolean(updatingId || deletingId)} onClick={() => changeStatus(shoe)}>
                    {updatingId === shoe.id ? "Menyimpan…" : shoe.status === "sold" ? "Jadikan tersedia" : "Tandai terjual"}
                  </button>
                  <button className="plain-button muted" disabled={Boolean(updatingId || deletingId)} onClick={() => { setDeleteError(""); setDeleting(shoe); }}>Hapus listing</button>
                  <Link className="plain-button" to={`/shoes/${shoe.id}`}>Lihat detail ↗</Link>
                </div>
              </article>
            ))}
          </div>
          <div className="home-catalog-footer">
            <span>Menampilkan {(page - 1) * meta.limit + 1}–{(page - 1) * meta.limit + shoes.length} dari {meta.totalItems} listing</span>
            {meta.totalPages > 1 && <nav className="home-pagination" aria-label="Halaman listing pribadi"><button disabled={page === 1 || Boolean(updatingId || deletingId)} aria-label="Halaman sebelumnya" onClick={() => setPage(page - 1)}>←</button><span aria-live="polite">{page} / {meta.totalPages}</span><button disabled={page >= meta.totalPages || Boolean(updatingId || deletingId)} aria-label="Halaman berikutnya" onClick={() => setPage(page + 1)}>→</button></nav>}
          </div>
        </>
      )}
      {deleting && <ConfirmDialog
        title="Hapus listing ini?"
        description={`${deleting.brand} ${deleting.article} akan hilang dari My Shoes dan katalog. Riwayat chat tetap tersimpan, tetapi tidak dapat menerima pesan baru.`}
        pending={Boolean(deletingId)}
        error={deleteError}
        onCancel={() => { if (!deletingId) setDeleting(null); }}
        onConfirm={deleteShoe}
      />}
    </section>
  );
}
