import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import axios from "axios";
import baseUrl from "../constants/baseUrl";
import ProductForm from "../components/ProductForm";

export default function EditProduct({ user, token, onUnauthorized }) {
  const { shoeId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(null);
  const busy = useRef(false);
  const request = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    async function getShoe() {
      try {
        const { data } = await axios.get(`${baseUrl}/shoes/${shoeId}`, {
          signal: controller.signal,
          timeout: 15000,
        });
        if (controller.signal.aborted) return;
        setResult({ shoeId, attempt, product: data.data });
      } catch (error) {
        if (axios.isCancel(error)) return;
        setResult({ shoeId, attempt, status: error.response?.status, error: error.response?.data?.error?.message || "Listing belum bisa dimuat. Periksa koneksi lalu coba lagi." });
      }
    }

    getShoe();
    return () => controller.abort();
  }, [shoeId, attempt]);

  useEffect(() => () => {
    request.current?.abort();
    busy.current = false;
  }, [shoeId]);

  async function updateShoe(formData) {
    if (busy.current) return;
    if (!token) {
      navigate(`/login?returnTo=${encodeURIComponent(`/my-shoes/${shoeId}/edit`)}`, { replace: true });
      return;
    }
    busy.current = true;
    setSaving({ shoeId, pending: true, error: "" });
    const controller = new AbortController();
    request.current = controller;

    try {
      const { data } = await axios.put(`${baseUrl}/shoes/${shoeId}`, formData, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        timeout: 60000,
      });
      if (controller.signal.aborted) return;
      navigate(`/shoes/${data.data.id}`, { replace: true });
    } catch (error) {
      if (axios.isCancel(error)) return;
      if (error.response?.status === 401) {
        onUnauthorized();
        navigate(`/login?returnTo=${encodeURIComponent(`/my-shoes/${shoeId}/edit`)}`, { replace: true });
        return;
      }
      const details = error.response?.data?.error?.details;
      setSaving({
        shoeId,
        pending: false,
        error: details?.length ? details.map((detail) => detail.message).join(". ") : error.response?.data?.error?.message || "Belum bisa memastikan perubahan tersimpan. Periksa detail listing sebelum mencoba lagi.",
      });
    } finally {
      if (request.current === controller) busy.current = false;
    }
  }

  const current = result?.shoeId === shoeId && result.attempt === attempt ? result : null;
  if (!current) return <section className="empty-state" role="status"><h1>Memuat listing kamu…</h1><p>Tunggu sebentar.</p></section>;
  if (current.error) return <section className="empty-state"><h1>{current.status === 404 ? "Listing tidak ditemukan." : "Listing belum bisa dibuka."}</h1><p role="alert">{current.error}</p><div>{current.status !== 404 && <button className="button dark" onClick={() => setAttempt(attempt + 1)}>Coba lagi</button>}<Link to="/my-shoes" className="button outline">Kembali ke My Shoes</Link></div></section>;
  if (current.product.seller.id !== user.id) return <section className="empty-state"><h1>Listing ini bukan milikmu.</h1><p>Hanya pemilik sepatu yang bisa mengedit listing.</p><Link to={`/shoes/${shoeId}`} className="button dark">Lihat detail sepatu</Link></section>;

  return <ProductForm key={current.product.id} product={current.product} onUpdate={updateShoe} pending={saving?.shoeId === shoeId && saving.pending} error={saving?.shoeId === shoeId ? saving.error : ""} />;
}
