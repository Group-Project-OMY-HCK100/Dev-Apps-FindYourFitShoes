import { Link } from "react-router";
export default function NotFound() { return <section className="empty-state"><span className="eyebrow">404 · WRONG TURN</span><h1>Sepertinya salah langkah.</h1><p>Halaman yang kamu cari belum ada.</p><Link to="/" className="button dark">Kembali ke home →</Link></section>; }
