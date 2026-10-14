import { useState } from "react";
import { Link, useParams } from "react-router";
import Icon from "../components/Icon";
import ProductCard from "../components/ProductCard";
import { chats } from "../data/chats";
import { previewUser, products, formatPrice, shoeName, shoeImages, conditions, categories, colors } from "../data/products";

function ProductContent({ product }) {
  const [activePhoto, setActivePhoto] = useState(0);
  const [notice, setNotice] = useState("");
  const user = previewUser;
  const images = shoeImages(product);
  const own = user?.id === product.seller.id;
  const sold = product.status === "sold";
  const exampleChat = chats.find((chat) => chat.shoe.id === product.id && !chat.shoe.isDeleted);
  const chatPath = `/chats/${exampleChat.id}`;
  const otherProducts = products.filter((item) => item.id !== product.id);

  return (
    <div className="detail-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link><span>/</span>
        <Link to="/">Sepatu preloved</Link><span>/</span>
        <span aria-current="page">{shoeName(product)}</span>
      </nav>

      <section className="detail-layout">
        <div className="detail-gallery"><div className="detail-photo">
          <img src={images[activePhoto]} alt={shoeName(product)} />
          <span className="condition">{conditions[product.condition]}</span>
          <span className="detail-photo-label">FOTO {activePhoto + 1} / {images.length}</span>
        </div><div className="gallery-thumbnails">{images.map((url, index) => <button aria-label={`Lihat foto ${index + 1}`} aria-pressed={activePhoto === index} className={activePhoto === index ? "active" : ""} key={url} onClick={() => setActivePhoto(index)}><img src={url} alt={`Foto ${index + 1}`} /></button>)}</div><p className="photo-help">Galeri mendukung hingga 5 foto. Listing contoh ini memiliki {images.length} foto.</p></div>

        <div className="detail-info">
          <span className="eyebrow">{product.brand} / PRELOVED</span>
          <h1>{shoeName(product)}</h1>
          <span className={`status-label ${product.status}`}>{sold ? "Terjual" : "Tersedia"}</span>
          <p className="detail-price">{formatPrice(product.price)}</p>

          <dl className="detail-specs">
            <div><dt>Ukuran</dt><dd>EU {product.size}</dd></div>
            <div><dt>Kondisi</dt><dd>{conditions[product.condition]}</dd></div>
            <div><dt>Kategori</dt><dd>{categories[product.category]}</dd></div><div><dt>Warna</dt><dd>{colors[product.color]}</dd></div>
          </dl>
          <p className="detail-size-note">Ukuran sepatu ini EU {product.size}. Tanyakan panjang insole ke penjual untuk memastikan ukuran.</p>

          <div className="detail-actions">
            {own ? <Link className="button dark" to={`/my-shoes/${product.id}/edit`}>Edit listing<Icon name="arrow" size={18} /></Link> : sold ? <button className="button dark" disabled>Sepatu sudah terjual</button> : <Link to={chatPath} className="button dark"><Icon name="chat" size={18} />Chat penjual<Icon name="arrow" size={18} /></Link>}
          </div>
          {own && <button className="button outline owner-status" onClick={() => setNotice(`Preview: status akan menjadi ${sold ? "tersedia" : "terjual"}. Data contoh tetap sama.`)}>{sold ? "Jadikan tersedia" : "Tandai terjual"}</button>}
          {sold && <p className="notice">Listing tetap bisa dilihat. Chat baru tidak tersedia; percakapan lama bisa dibuka melalui inbox.</p>}
          {notice && <p className="notice" role="status">{notice}</p>}
          <p className="detail-preview-note">Contoh tampilan akun Raka. Data produk dan percakapan belum terhubung ke server.</p>

          <section className="detail-seller" aria-label="Informasi penjual">
            <span className="avatar">{product.seller.name.charAt(0)}</span>
            <div><small>DIJUAL OLEH</small><h2>{product.seller.name}</h2><p>{own ? "Listing milikmu" : "Pemilik listing"}</p></div>
            
          </section>
        </div>
      </section>

      <div className="detail-description-layout">
        <section className="detail-description">
          <h2>DESKRIPSI PRODUK</h2>
          <p>{product.description}</p>
          <p className="detail-description-note">Deskripsi contoh untuk tampilan. Foto dan detail kondisi nantinya diisi oleh penjual.</p>
        </section>
        <aside className="detail-buying-note">
          <h2>SEBELUM MEMBELI</h2>
          <p>Minta foto detail bagian sol, insole, dan kekurangan sepatu. Konfirmasi ukuran, kelengkapan, serta pengiriman langsung dengan penjual.</p>
        </aside>
      </div>

      <section className="detail-related">
        <div className="section-heading"><h2>SEPATU LAINNYA</h2><Link to="/" className="text-link">Lihat semua<Icon name="arrow" size={16} /></Link></div>
        <div className="product-grid">{otherProducts.map((item) => <ProductCard key={item.id} product={item} />)}</div>
      </section>
    </div>
  );
}

export default function ProductDetail() {
  const { shoeId } = useParams();
  const product = products.find((item) => item.id === shoeId);

  if (!product) {
    return (
      <section className="empty-state">
        <span className="eyebrow">PRODUK TIDAK DITEMUKAN</span>
        <h1>Sepatu ini belum tersedia.</h1>
        <p>Kembali ke katalog untuk melihat sepatu lainnya.</p>
        <Link to="/" className="button dark">Lihat koleksi<Icon name="arrow" /></Link>
      </section>
    );
  }

  return <ProductContent key={product.id} product={product} />;
}
