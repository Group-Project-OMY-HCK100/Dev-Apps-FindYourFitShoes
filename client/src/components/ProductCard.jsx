import { useState } from "react";
import { Link } from "react-router";
import Icon from "./Icon";
import { formatPrice } from "../data/products";

export default function ProductCard({ product }) {
  const [saved, setSaved] = useState(false);
  const detailPath = `/products/${product.id}`;

  return (
    <article className="product-card">
      <div className="product-image">
        <Link className="product-image-link" to={detailPath} aria-label={`Lihat detail ${product.name}`}>
          <img src={product.image} alt={product.name} loading="lazy" />
        </Link>
        <span className="condition">{product.condition}</span>
        <button className={`save-button ${saved ? "saved" : ""}`} aria-label={saved ? "Hapus dari favorit" : "Simpan ke favorit"} aria-pressed={saved} onClick={() => setSaved(!saved)}><Icon name="heart" size={18} /></button>
      </div>
      <div className="product-info">
        <div className="product-meta">{product.brand}<span>EU {product.size}</span></div>
        <h3><Link to={detailPath}>{product.name}</Link></h3>
        <strong>{formatPrice(product.price)}</strong>
        <p><Icon name="location" size={13} />{product.city}</p>
        <div className="product-bottom"><span>{product.seller}</span><Link to="/chat">Tanya penjual<Icon name="arrow" size={14} /></Link></div>
        <Link className="edit-preview" to={`/editproduct/${product.id}`}>Preview edit produk ↗</Link>
      </div>
    </article>
  );
}
