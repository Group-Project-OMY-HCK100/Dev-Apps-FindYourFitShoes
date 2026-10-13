import { useState } from "react";
import { Link, useParams } from "react-router";
import Icon from "../components/Icon";
import ProductCard from "../components/ProductCard";
import { products, formatPrice } from "../data/products";

function ProductContent({ product }) {
  const [saved, setSaved] = useState(false);
  const otherProducts = products.filter((item) => item.id !== product.id);

  return (
    <div className="detail-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link><span>/</span>
        <Link to="/">Sepatu preloved</Link><span>/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <section className="detail-layout">
        <div className="detail-photo">
          <img src={product.image} alt={product.name} />
          <span className="condition">{product.condition}</span>
          <span className="detail-photo-label">FOTO PRODUK · PREVIEW</span>
        </div>

        <div className="detail-info">
          <span className="eyebrow">{product.brand} / PRELOVED</span>
          <h1>{product.name}</h1>
          <p className="detail-location"><Icon name="location" size={15} />{product.city}</p>
          <p className="detail-price">{formatPrice(product.price)}</p>

          <dl className="detail-specs">
            <div><dt>Ukuran</dt><dd>EU {product.size}</dd></div>
            <div><dt>Kondisi</dt><dd>{product.condition}</dd></div>
            <div><dt>Merek</dt><dd>{product.brand}</dd></div>
          </dl>
          <p className="detail-size-note">Satu pasang tersedia dalam ukuran EU {product.size}. Tanyakan panjang insole ke penjual untuk memastikan ukuran.</p>

          <div className="detail-actions">
            <Link to="/chat" className="button dark"><Icon name="chat" size={18} />Chat penjual<Icon name="arrow" size={18} /></Link>
            <button className={`detail-save ${saved ? "saved" : ""}`} aria-label={saved ? "Hapus dari favorit" : "Simpan ke favorit"} aria-pressed={saved} onClick={() => setSaved(!saved)}><Icon name="heart" /></button>
          </div>
          <p className="detail-preview-note">Data produk dan percakapan masih berupa contoh.</p>

          <section className="detail-seller" aria-label="Informasi penjual">
            <span className="avatar">{product.seller.charAt(0)}</span>
            <div><small>DIJUAL OLEH</small><h2>{product.seller}</h2><p>{product.city}</p></div>
            <Link to="/chat" aria-label={`Chat dengan ${product.seller}`}><Icon name="arrow" size={20} /></Link>
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
  const { id } = useParams();
  const product = products.find((item) => item.id === Number(id));

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
