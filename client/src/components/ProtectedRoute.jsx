import { Navigate, Outlet, useLocation } from "react-router";

export default function ProtectedRoute({ user, loading, error, onRetry }) {
  const location = useLocation();
  if (loading) return <section className="empty-state" role="status"><h1>Memeriksa sesi akun…</h1><p>Tunggu sebentar.</p></section>;
  if (error) return <section className="empty-state"><h1>Sesi belum bisa diperiksa.</h1><p role="alert">{error}</p><button className="button dark" onClick={onRetry}>Coba lagi</button></section>;
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace state={location.state} />;
  return <Outlet />;
}
