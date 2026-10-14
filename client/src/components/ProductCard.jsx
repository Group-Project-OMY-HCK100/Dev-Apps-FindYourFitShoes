import { Link } from "react-router";
import { conditions, formatPrice, shoeName } from "../data/products";
export default function ProductCard({ product }) {
  return <article className="product-card">
    <div className="product-image"><Link className="product-image-link" to={`/shoes/${product.id}`} aria-label={`Lihat detail ${shoeName(product)}`}><img src={product.imgUrl1} alt={shoeName(product)} loading="lazy" /></Link><span className="condition">{conditions[product.condition]}</span>{product.status === "sold" && <span className="sold-badge">SOLD</span>}</div>
    <div className="product-info"><div className="product-meta">{product.brand}<span>EU {product.size}</span></div><h3><Link to={`/shoes/${product.id}`}>{product.article}</Link></h3><strong>{formatPrice(product.price)}</strong><div className="product-bottom"><span>{product.seller.name}</span><Link to={`/shoes/${product.id}`}>Lihat detail ↗</Link></div></div>
  </article>;
}
