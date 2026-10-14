import { BrowserRouter, Route, Routes } from "react-router";
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shoes/:shoeId" element={<ProductDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/my-shoes" element={<MyShoes />} />
          <Route path="/my-shoes/add" element={<AddProduct />} />
          <Route path="/my-shoes/:shoeId/edit" element={<EditProduct />} />
          <Route path="/chats" element={<Chat />} />
          <Route path="/chats/:chatId" element={<Chat />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
export default App;
