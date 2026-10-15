import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { clearFormError, loginAsync, registerAsync } from "../features/auth/authSlice";
import Icon from "./Icon";

export default function AuthForm({ register = false }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const dispatch = useDispatch();
  const { user, loading: checking, submitting: loading, formError: error } = useSelector((state) => state.auth);
  const [showPassword, setShowPassword] = useState(false);
  const busy = useRef(false);
  const request = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const from = params.get("returnTo");
  // Tujuan hanya boleh berupa route internal aplikasi.
  const uuid = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
  const allowed = new RegExp(`^(?:/|/shoes|/shoes/${uuid}|/my-shoes|/my-shoes/add|/my-shoes/${uuid}/edit|/chats|/chats/${uuid})$`);
  const destination = typeof from === "string" && allowed.test(from) ? from : "/";
  const switchPath = `${register ? "/login" : "/register"}${destination === "/" ? "" : `?returnTo=${encodeURIComponent(destination)}`}`;
  const disabled = loading || checking;
  useEffect(() => {
    dispatch(clearFormError());
    return () => request.current?.abort();
  }, [dispatch, register]);

  async function submit(event) {
    event.preventDefault();
    if (busy.current || disabled) return;
    busy.current = true;
    const controller = new AbortController();
    request.current = controller;
    try {
      const body = { email: email.trim().toLowerCase(), password };
      if (register) body.name = name.trim();
      const action = register ? registerAsync(body, controller.signal) : loginAsync(body, controller.signal);
      const account = await dispatch(action);
      if (controller.signal.aborted || !account) return;
      navigate(destination, { replace: true, state: location.state });
    } finally {
      busy.current = false;
    }
  }

  if (user && !loading) return <Navigate to={destination} replace state={location.state} />;

  return (
    <section className="auth-page">
      <div className="auth-story">
        <span className="eyebrow">SOLE SWAP / MEMBER</span>
        <h1>SEPATU FAVORIT.<br />DALAM SATU<br />TEMPAT.</h1>
        <p>Hubungi penjual atau mulai jual koleksi sepatu yang sudah jarang kamu pakai.</p>
        <span className="auth-bottom">BELI / JUAL / PRELOVED</span>
      </div>
      <div className="auth-form">
        <span className="eyebrow">{register ? "BUAT AKUN" : "AKUN SAYA"}</span>
        <h2>{register ? "Daftar Sole Swap" : "Masuk ke akun"}</h2>
        <p>{destination !== "/" ? "Masuk atau daftar untuk melanjutkan ke halaman yang kamu pilih." : register ? "Satu akun untuk membeli dan menjual sepatu." : "Masuk dan lanjutkan mencari pasangan yang pas."}</p>
        <form onSubmit={submit} aria-busy={loading}>
          {register && (
            <label>Nama lengkap
              <input name="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} disabled={disabled} placeholder="Nama kamu" autoComplete="name" />
            </label>
          )}
          <label>Email
            <input name="email" value={email} onChange={(event) => setEmail(event.target.value)} required type="email" maxLength={320} disabled={disabled} placeholder="nama@email.com" autoComplete="email" />
          </label>
          <label>Password
            <div className="password-input">
              <input name="password" value={password} onChange={(event) => setPassword(event.target.value)} required type={showPassword ? "text" : "password"} minLength={register ? 8 : undefined} maxLength={register ? 72 : undefined} disabled={disabled} placeholder={register ? "Minimal 8 karakter" : "Password kamu"} autoComplete={register ? "new-password" : "current-password"} />
              <button type="button" disabled={disabled} onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword}>{showPassword ? "Sembunyikan" : "Lihat"}</button>
            </div>
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {checking && <p className="session-note" role="status">Memeriksa sesi sebelumnya…</p>}
          <button disabled={disabled} className="button dark full" type="submit">{loading ? "Memproses…" : register ? "Buat akun" : "Masuk"}<Icon name="arrow" /></button>
          <p className="session-note">Sesi login disimpan selama tab ini terbuka.</p>
        </form>
        <p className="auth-switch">{register ? "Sudah punya akun?" : "Belum punya akun?"} <Link to={switchPath} state={location.state}>{register ? "Masuk di sini" : "Daftar sekarang"}</Link></p>
        <Link className="back-link" to="/">← Kembali ke katalog</Link>
      </div>
    </section>
  );
}
