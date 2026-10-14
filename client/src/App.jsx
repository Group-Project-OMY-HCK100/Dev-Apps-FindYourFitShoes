import { useCallback, useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { logoutAsync, restoreSessionAsync } from "./features/auth/authSlice";
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
  const dispatch = useDispatch();
  const { user, token, loading, error } = useSelector((state) => state.auth);

  const logout = useCallback(() => {
    dispatch(logoutAsync());
  }, [dispatch]);

  useEffect(() => {
    const controller = new AbortController();
    dispatch(restoreSessionAsync(controller.signal));
    return () => controller.abort();
  }, [dispatch]);

  function retrySession() {
    dispatch(restoreSessionAsync());
  }

  return (
    <BrowserRouter>
      <ChatProvider key={token || "guest"} token={token} onUnauthorized={logout}>
      <Routes>
        <Route element={<Layout user={user} loading={loading} onLogout={logout} />}>
          <Route path="/" element={<Home />} />
          <Route path="/shoes" element={<Home />} />
          <Route path="/shoes/:shoeId" element={<ProductDetail user={user} token={token} onUnauthorized={logout} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
