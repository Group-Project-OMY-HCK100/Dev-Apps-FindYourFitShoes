import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import axios from "axios";
import baseUrl from "../constants/baseUrl";
import Icon from "../components/Icon";
import { conditions, categories, colors } from "../data/products";

function ProductPhoto({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="detail-image-fallback" role="img" aria-label={`${alt}, foto tidak tersedia`}><Icon name="shoe" size={48} /><span>Foto tidak tersedia</span></div>;
  }
  return <img src={src} alt={alt} onError={() => setFailed(true)} />;
}

function ProductContent({ product, user, token, onUnauthorized }) {
  const navigate = useNavigate();
  const [startingChat, setStartingChat] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatRequest = useRef(null);
  useEffect(() => () => chatRequest.current?.abort(), []);
  const [activePhoto, setActivePhoto] = useState(0);
  const images = [product.imgUrl1, product.imgUrl2, product.imgUrl3, product.imgUrl4, product.imgUrl5].filter(Boolean);
  const own = user?.id === product.seller.id;
  const sold = product.status === "sold";
  const name = `${product.brand} ${product.article}`;
  const price = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(product.price);

  async function startChat() {
    if (!user || !token) { navigate("/login"); return; }
    setStartingChat(true);
    setChatError("");
    const controller = new AbortController();
    chatRequest.current = controller;
    try {
      const { data } = await axios.post(`${baseUrl}/chats`, { shoeId: product.id }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000, signal: controller.signal });
      if (controller.signal.aborted) return;
      navigate(`/chats/${data.data.id}`);
    } catch (problem) {
      if (axios.isCancel(problem)) return;
      if (problem.response?.status === 401) onUnauthorized();
      const messages = { SELF_CHAT_NOT_ALLOWED: "Kamu tidak bisa menghubungi diri sendiri.", SHOE_NOT_AVAILABLE: "Sepatu sudah tidak tersedia untuk chat baru.", SHOE_NOT_FOUND: "Listing sepatu sudah tidak ditemukan." };
      setChatError(messages[problem.response?.data?.error?.code] || problem.response?.data?.error?.message || "Chat belum bisa dibuat. Coba lagi.");
    } finally { setStartingChat(false); }
  }

  return (
    <div className="detail-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link><span>/</span>
        <Link to="/shoes">Sepatu preloved</Link><span>/</span>
        <span aria-current="page">{name}</span>
      </nav>

      <section className="detail-layout">
        <div className="detail-gallery">
          <div className="detail-photo">
            <ProductPhoto key={images[activePhoto] || "no-photo"} src={images[activePhoto]} alt={`${name}, foto ${activePhoto + 1}`} />
            <span className="condition">{conditions[product.condition] || product.condition}</span>
            {images.length > 0 && <span className="detail-photo-label">FOTO {activePhoto + 1} / {images.length}</span>}
          </div>
          {images.length > 1 && (
            <div className="gallery-thumbnails" aria-label="Pilih foto sepatu">
              {images.map((url, index) => (
                <button key={`${url}-${index}`} type="button" aria-label={`Lihat foto ${index + 1} dari ${images.length}`} aria-pressed={activePhoto === index} className={activePhoto === index ? "active" : ""} onClick={() => setActivePhoto(index)}>
                  <ProductPhoto src={url} alt="" />
                </button>
              ))}
            </div>
          )}
          <p className="detail-photo-note">Foto dari penjual. Tanyakan detail tambahan melalui chat.</p>
        </div>

        <div className="detail-info">
          <span className="eyebrow">{product.brand} / PRELOVED</span>
          <h1>{name}</h1>
          <span className={`status-label ${product.status}`}>{sold ? "Terjual" : "Tersedia"}</span>
          <p className="detail-price">{price}</p>

          <dl className="detail-specs">
            <div><dt>Ukuran</dt><dd>EU {product.size}</dd></div>
            <div><dt>Kondisi</dt><dd>{conditions[product.condition] || product.condition}</dd></div>
            <div><dt>Kategori</dt><dd>{categories[product.category] || product.category}</dd></div>
            <div><dt>Warna</dt><dd>{colors[product.color] || product.color}</dd></div>
          </dl>
          <p className="detail-size-note">Pastikan ukurannya pas. Tanyakan panjang insole dan kondisi bagian sol kepada penjual.</p>

          <div className="detail-actions">
            {own ? (
              <Link className="button dark" to={`/my-shoes/${product.id}/edit`}>Edit listing<Icon name="arrow" size={18} /></Link>
            ) : sold ? (
              <button className="button dark" disabled>Sepatu sudah terjual</button>
            ) : (
              <button disabled={startingChat} onClick={startChat} className="button dark"><Icon name="chat" size={18} />{startingChat ? "Membuka chat…" : "Chat penjual"}<Icon name="arrow" size={18} /></button>
            )}
          </div>
          {chatError && <p className="notice" role="alert">{chatError}</p>}
          {sold ? (
            <p className="notice">Sepatu ini sudah terjual. Chat baru tidak tersedia; percakapan yang sudah ada tetap bisa dibuka melalui inbox.</p>
          ) : !own && (
            <p className="detail-action-note">{user ? "Diskusikan harga dan rencana COD langsung dengan penjual." : "Masuk untuk menghubungi penjual. Kamu tetap bisa melihat detail sepatu tanpa akun."}</p>
          )}

          <section className="detail-seller" aria-label="Informasi penjual">
            <span className="avatar">{product.seller.name.charAt(0)}</span>
            <div><small>DIJUAL OLEH</small><h2>{product.seller.name}</h2><p>{own ? "Ini listing milikmu" : "Pemilik listing"}</p></div>
          </section>
          <p className="detail-posted">Diposting {new Date(product.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
      </section>

      <div className="detail-description-layout">
        <section className="detail-description">
          <h2>DESKRIPSI PRODUK</h2>
          <p>{product.description}</p>
        </section>
        <aside className="detail-buying-note">
          <h2>SEBELUM MEMBELI</h2>
          <p>Minta foto detail bagian sol, insole, dan kekurangan sepatu. Konfirmasi ukuran, kelengkapan, serta rencana COD langsung dengan penjual.</p>
        </aside>
      </div>
      <div className="detail-return"><Link className="text-link" to="/shoes">← Kembali ke koleksi sepatu</Link></div>
    </div>
  );
}

export default function ProductDetail({ user, token, onUnauthorized }) {
  const { shoeId } = useParams();
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function getShoe() {
      try {
        const { data } = await axios.get(`${baseUrl}/shoes/${shoeId}`, {
          signal: controller.signal,
          timeout: 15000,
        });
        if (controller.signal.aborted) return;
        setResult({ shoeId, attempt, product: data.data });
      } catch (error) {
        if (axios.isCancel(error)) return;
        setResult({
          shoeId,
          attempt,
          status: error.response?.status,
          error: error.response?.data?.error?.message || "Detail belum bisa dimuat. Periksa koneksi atau coba lagi sebentar.",
        });
      }
    }

    getShoe();
    return () => controller.abort();
  }, [shoeId, attempt]);

  const current = result?.shoeId === shoeId && result.attempt === attempt ? result : null;

  if (!current) {
    return (
      <section className="detail-page detail-loading" role="status" aria-busy="true">
        <p>Memuat detail sepatu…</p>
        <div className="detail-loading-grid" aria-hidden="true"><div className="detail-loading-photo" /><div className="detail-loading-info">{[1, 2, 3, 4, 5].map((item) => <span key={item} />)}</div></div>
      </section>
    );
  }

  if (current.error) {
    const notFound = current.status === 404 || current.status === 422;
    return (
      <section className="empty-state detail-error">
        <span className="eyebrow">{notFound ? "LISTING TIDAK TERSEDIA" : "GAGAL MEMUAT DETAIL"}</span>
        <h1>{notFound ? "Sepatu ini tidak ditemukan." : "Detail belum bisa ditampilkan."}</h1>
        <p role="alert">{notFound ? "Listing mungkin sudah dihapus atau tautannya tidak valid. Coba lihat koleksi lainnya." : current.error}</p>
        <div>{!notFound && <button className="button dark" onClick={() => setAttempt(attempt + 1)}>Coba lagi<Icon name="arrow" size={17} /></button>}<Link className={`button ${notFound ? "dark" : "outline"}`} to="/shoes">Kembali ke koleksi</Link></div>
      </section>
    );
  }

  return <ProductContent key={`${current.product.id}:${token || "guest"}`} product={current.product} user={user} token={token} onUnauthorized={onUnauthorized} />;
}
