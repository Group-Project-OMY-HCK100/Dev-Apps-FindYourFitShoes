import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useEffect } from "react";
import Icon from "./Icon";

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return <>
    <div className="announcement">MARKETPLACE SEPATU PRELOVED <span>Beli dan jual langsung dengan sesama pecinta sepatu.</span></div>
    <header className="header"><Link to="/" className="logo"><span className="logo-icon"><Icon name="shoe" size={26} /></span>sole<span>swap</span><small>®</small></Link>
      <nav aria-label="Navigasi utama"><NavLink to="/" end>Sepatu</NavLink><NavLink to="/addproduct">Jual sepatu</NavLink><NavLink to="/chat"><Icon name="chat" /> <span>Pesan</span></NavLink></nav>
      <div className="header-actions"><NavLink to="/login" className="login-link">Masuk</NavLink><Link to="/register" className="button dark small">Daftar <Icon name="arrow" size={16} /></Link></div>
    </header>
    <main><Outlet /></main>
    <footer><Link to="/" className="logo">sole<span>swap</span><small>®</small></Link><p>Beli. Pakai. Jual lagi.</p><span>© 2026 Sole Swap · Template preview</span></footer>
  </>;
}
