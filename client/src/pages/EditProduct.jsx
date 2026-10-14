import { useParams, Link } from "react-router";
import ProductForm from "../components/ProductForm";
import { previewUser, products } from "../data/products";

export default function EditProduct() {
  const { shoeId } = useParams();
  const user = previewUser;
  const product = products.find((item) => item.id === shoeId);
  if (!product || product.seller.id !== user.id) return <section className="empty-state"><h1>Listing ini tidak bisa diedit.</h1><p>Kamu hanya bisa mengedit sepatu milik akunmu.</p><Link to="/my-shoes" className="button dark">Kembali ke My Shoes</Link></section>;
  return <ProductForm key={product.id} product={product} />;
}
