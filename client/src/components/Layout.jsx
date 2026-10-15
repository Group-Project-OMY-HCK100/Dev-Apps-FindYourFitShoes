import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import Icon from "./Icon";
import { useChat } from "../lib/chat-context";
import { useTheme } from "../lib/theme-context";

export default function Layout({ user, loading, onLogout }) {
  const { totalUnread } = useChat();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => {
    let frame = null;
    function updateScroll() {
      setScrolled(window.scrollY > 64);
      frame = null;
    }
    function onScroll() {
      if (frame === null) frame = window.requestAnimationFrame(updateScroll);
    }
    updateScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);
  function logout() { onLogout(); navigate("/", { replace: true }); }
  return <>
    <div className="announcement">MARKETPLACE SEPATU PRELOVED <span>Beli dan jual langsung dengan sesama pecinta sepatu.</span></div>
    <div className={`navbar-shell${scrolled ? " is-scrolled" : ""}`}>
    <header className="header">
      <Link to="/" className="brand-logo" aria-label="SoleSwap — beranda">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter">
            <path d="M7 10h18M21 6l4 4-4 4M25 22H7M11 18l-4 4 4 4" />
          </svg>
        </span>
        <span className="brand-wordmark">Sole<span>Swap</span></span>
      </Link>
      <nav aria-label="Navigasi utama"><NavLink to="/" end>Sepatu</NavLink>{user && <><NavLink to="/my-shoes/add">Jual sepatu</NavLink><NavLink to="/my-shoes" end>My Shoes</NavLink><NavLink to="/chats"><Icon name="chat" /><span>Inbox</span>{totalUnread > 0 && <b className="unread-badge" aria-label={`${totalUnread} pesan belum dibaca`}>{totalUnread}</b>}</NavLink></>}</nav>
      <div className="header-actions">
        <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label="Mode gelap" aria-pressed={theme === "dark"} title={theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}>
          <Icon name={theme === "dark" ? "sun" : "moon"} size={19} />
        </button>
        {loading ? <span role="status">Memeriksa sesi…</span> : user ? <><span className="member-name">{user.name}</span><button className="logout-button" onClick={logout}>Keluar</button></> : <><NavLink to="/login">Masuk</NavLink><Link to="/register" className="button dark small">Daftar<Icon name="arrow" size={16} /></Link></>}</div>
    </header>
    </div>
    <main><Outlet /></main>
    <footer><Link to="/" className="logo">sole<span>swap</span><small>®</small></Link><p>Beli. Pakai. Jual lagi.</p><span>© 2026 Sole Swap</span></footer>
  </>;
}
