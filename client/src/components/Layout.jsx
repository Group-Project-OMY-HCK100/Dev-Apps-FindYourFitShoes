import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useEffect } from "react";
import Icon from "./Icon";
import { useChat } from "../lib/chat-context";

export default function Layout({ user, loading, onLogout }) {
  const { totalUnread } = useChat();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  function logout() { onLogout(); navigate("/", { replace: true }); }
  return <>
    <div className="announcement">MARKETPLACE SEPATU PRELOVED <span>Beli dan jual langsung dengan sesama pecinta sepatu.</span></div>
    <header className="header">
      <Link to="/" className="logo"><span className="logo-icon"><Icon name="shoe" size={26} /></span>sole<span>swap</span><small>®</small></Link>
      <nav aria-label="Navigasi utama"><NavLink to="/" end>Sepatu</NavLink>{user && <><NavLink to="/my-shoes/add">Jual sepatu</NavLink><NavLink to="/my-shoes" end>My Shoes</NavLink><NavLink to="/chats"><Icon name="chat" /><span>Inbox</span>{totalUnread > 0 && <b className="unread-badge" aria-label={`${totalUnread} pesan belum dibaca`}>{totalUnread}</b>}</NavLink></>}</nav>
      <div className="header-actions">{loading ? <span role="status">Memeriksa sesi…</span> : user ? <><span className="member-name">{user.name}</span><button className="logout-button" onClick={logout}>Keluar</button></> : <><NavLink to="/login">Masuk</NavLink><Link to="/register" className="button dark small">Daftar<Icon name="arrow" size={16} /></Link></>}</div>
    </header>
    <main><Outlet /></main>
    <footer><Link to="/" className="logo">sole<span>swap</span><small>®</small></Link><p>Beli. Pakai. Jual lagi.</p><span>© 2026 Sole Swap</span></footer>
  </>;
}
