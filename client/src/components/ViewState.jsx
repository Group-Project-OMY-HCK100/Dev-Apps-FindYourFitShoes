import { Link } from "react-router";
export default function ViewState({ state, onReset, title = "Belum ada data." }) {
  if (state === "loading") return <div className="loading-preview" role="status"><div className="skeleton-grid">{[1, 2, 3].map((item) => <div className="skeleton-card" key={item}><div /><span /><span /></div>)}</div><p>Memuat data… <small>Contoh tampilan loading</small></p></div>;
  return <div className="empty-state compact"><span className="eyebrow">{state === "error" ? "TERJADI KENDALA" : "BELUM ADA HASIL"}</span><h2>{state === "error" ? "Data belum bisa dimuat." : title}</h2><p>{state === "error" ? "Silakan coba lagi dalam beberapa saat." : "Coba pilihan lain atau mulai tambahkan sepatu."}</p>{onReset ? <button className="button outline" onClick={onReset}>{state === "error" ? "Coba lagi" : "Reset tampilan"}</button> : <Link className="button dark" to="/">Kembali ke katalog</Link>}</div>;
}
