import { useParams, Link } from "react-router";
import ProductForm from "../components/ProductForm";
import { products } from "../data/products";
export default function EditProduct() {
  const { id } = useParams();
  const product = products.find(item => item.id === Number(id));
  if (!product) return <section className="empty-state"><h1>Produk tidak ditemukan.</h1><p>Pakai ID 1–4 untuk melihat template edit produk.</p><Link to="/" className="button dark">Kembali ke home</Link></section>;
  return <ProductForm key={product.id} product={product} />;
}
