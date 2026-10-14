import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import axios from "axios";
import baseUrl from "./constants/baseUrl";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MyShoes from "./pages/MyShoes";
import AddProduct from "./pages/AddProduct";
import EditProduct from "./pages/EditProduct";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";
import ChatProvider from "./components/ChatProvider";

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("access_token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const logout = useCallback(() => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("soleswap.session");
    setToken(null);
    setUser(null);
    setLoading(false);
    setError("");
  }, []);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    async function getProfile() {
      try {
        const { data } = await axios.get(`${baseUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          timeout: 15000,
        });
        if (controller.signal.aborted) return;
        setUser(data.data);
        setError("");
      } catch (problem) {
        if (axios.isCancel(problem)) return;
        if (problem.response?.status === 401) logout();
        else setError(problem.response?.data?.error?.message || "Sesi belum bisa diperiksa. Pastikan server berjalan lalu coba lagi.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    getProfile();
    return () => controller.abort();
  }, [token, attempt, logout]);

  function handleAuthenticated(data) {
    sessionStorage.setItem("access_token", data.accessToken);
    sessionStorage.removeItem("soleswap.session");
    setToken(data.accessToken);
    setUser(data.user);
    setError("");
    setLoading(false);
  }

  function retrySession() {
    setLoading(true);
    setError("");
    setAttempt(attempt + 1);
  }

  return (
    <BrowserRouter>
      <ChatProvider key={token || "guest"} token={token} onUnauthorized={logout}>
      <Routes>
        <Route element={<Layout user={user} loading={loading} onLogout={logout} />}>
          <Route path="/" element={<Home />} />
          <Route path="/shoes" element={<Home />} />
          <Route path="/shoes/:shoeId" element={<ProductDetail user={user} token={token} onUnauthorized={logout} />} />
          <Route path="/login" element={<Login onAuthenticated={handleAuthenticated} user={user} checking={loading} />} />
          <Route path="/register" element={<Register onAuthenticated={handleAuthenticated} user={user} checking={loading} />} />
          <Route element={<ProtectedRoute user={user} loading={loading} error={error} onRetry={retrySession} />}>
            <Route path="/my-shoes" element={<MyShoes token={token} onUnauthorized={logout} />} />
            <Route path="/my-shoes/add" element={<AddProduct token={token} onUnauthorized={logout} />} />
            <Route path="/my-shoes/:shoeId/edit" element={<EditProduct user={user} token={token} onUnauthorized={logout} />} />
            <Route path="/chats" element={<Chat user={user} />} />
            <Route path="/chats/:chatId" element={<Chat user={user} />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </ChatProvider>
    </BrowserRouter>
  );
}
export default App;
