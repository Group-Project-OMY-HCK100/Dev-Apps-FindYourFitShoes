import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import axios from "axios";
import baseUrl from "../constants/baseUrl";
import ProductForm from "../components/ProductForm";

export default function AddProduct({ token, onUnauthorized }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const request = useRef(null);
  const navigate = useNavigate();

  useEffect(() => () => request.current?.abort(), []);

  async function createShoe(formData) {
    if (busy.current) return;
    if (!token) {
      navigate("/login?returnTo=%2Fmy-shoes%2Fadd", { replace: true });
      return;
    }

    busy.current = true;
    setLoading(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;

    try {
      const { data } = await axios.post(`${baseUrl}/shoes`, formData, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        timeout: 60000,
      });
      if (controller.signal.aborted) return;
      navigate(`/shoes/${data.data.id}`, { replace: true });
    } catch (problem) {
      if (axios.isCancel(problem)) return;
      if (problem.response?.status === 401) {
        onUnauthorized();
        navigate("/login?returnTo=%2Fmy-shoes%2Fadd", { replace: true });
        return;
      }
      const details = problem.response?.data?.error?.details;
      setError(details?.length
        ? details.map((detail) => detail.message).join(". ")
        : problem.response?.data?.error?.message || "Belum bisa memastikan listing tersimpan. Periksa katalog sebelum mencoba lagi.");
    } finally {
      busy.current = false;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return <ProductForm onCreate={createShoe} pending={loading} error={error} />;
}
