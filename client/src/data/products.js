// Mock sesuai bentuk data PRD. Tidak terhubung ke server.
export const previewUser = { id: "10000000-0000-4000-8000-000000000001", name: "Raka Pratama" };
const dimas = { id: "10000000-0000-4000-8000-000000000002", name: "Dimas Aditya" };
const nadia = { id: "10000000-0000-4000-8000-000000000003", name: "Nadia Putri" };

export const categories = { running: "Running", casual: "Casual", basketball: "Basketball", formal: "Formal", sneakers: "Sneakers", other: "Lainnya" };
export const conditions = { like_new: "Seperti baru", good: "Baik", fair: "Cukup baik" };
export const colors = { black: "Hitam", white: "Putih", gray: "Abu-abu", red: "Merah", blue: "Biru", green: "Hijau", yellow: "Kuning", brown: "Cokelat", beige: "Beige", purple: "Ungu", pink: "Pink", orange: "Oranye", neon: "Neon", multicolor: "Multicolor", other: "Lainnya" };
const photos = [
  "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1494496195158-c3becb4f2475?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1518002171953-a080ee817e1f?auto=format&fit=crop&w=900&q=85",
];
export const products = [
  { id: "20000000-0000-4000-8000-000000000001", seller: dimas, brand: "Nike", article: "Air Force 1 '07", category: "casual", condition: "like_new", size: 42, color: "brown", price: 650000, status: "available", imgUrl1: photos[0], imgUrl2: null, imgUrl3: null, imgUrl4: null, imgUrl5: null, description: "Jarang dipakai, upper masih terawat dan sol masih bagus. Hubungi penjual untuk detail kondisi dan kelengkapan." },
  { id: "20000000-0000-4000-8000-000000000002", seller: previewUser, brand: "New Balance", article: "550", category: "sneakers", condition: "good", size: 41, color: "white", price: 850000, status: "available", imgUrl1: photos[1], imgUrl2: null, imgUrl3: null, imgUrl4: null, imgUrl5: null, description: "Dipakai untuk kegiatan sehari-hari. Ada bekas pemakaian ringan di bagian sol. Ukuran EU 41, silakan chat untuk panjang insole." },
  { id: "20000000-0000-4000-8000-000000000003", seller: nadia, brand: "Converse", article: "Chuck Taylor", category: "casual", condition: "good", size: 40, color: "black", price: 320000, status: "sold", imgUrl1: photos[2], imgUrl2: null, imgUrl3: null, imgUrl4: null, imgUrl5: null, description: "Sepatu kanvas dengan bekas pemakaian ringan. Bagian sol masih layak digunakan. Listing ini sudah terjual." },
  { id: "20000000-0000-4000-8000-000000000004", seller: previewUser, brand: "Adidas", article: "Originals", category: "sneakers", condition: "like_new", size: 43, color: "white", price: 480000, status: "sold", imgUrl1: photos[3], imgUrl2: null, imgUrl3: null, imgUrl4: null, imgUrl5: null, description: "Kondisi terawat dan jarang digunakan. Listing ini sudah terjual, riwayat chat tetap tersedia untuk koordinasi." },
  { id: "20000000-0000-4000-8000-000000000005", seller: nadia, brand: "Nike", article: "Running Collection", category: "running", condition: "fair", size: 42.5, color: "black", price: 350000, status: "available", imgUrl1: photos[3], imgUrl2: null, imgUrl3: null, imgUrl4: null, imgUrl5: null, description: "Ada bekas pemakaian pada upper dan sol. Cocok untuk aktivitas ringan. Minta foto detail sebelum membeli." },
  { id: "20000000-0000-4000-8000-000000000006", seller: dimas, brand: "New Balance", article: "Daily Sneakers", category: "casual", condition: "good", size: 40.5, color: "beige", price: 450000, status: "available", imgUrl1: photos[1], imgUrl2: null, imgUrl3: null, imgUrl4: null, imgUrl5: null, description: "Sepatu untuk pemakaian kasual dengan kondisi baik. Silakan konfirmasi ukuran, kondisi, dan kelengkapan melalui chat." },
].map((shoe, index) => ({ ...shoe, currency: "IDR", createdAt: `2026-10-${String(14 - index).padStart(2, "0")}T09:00:00.000Z`, updatedAt: "2026-10-14T09:00:00.000Z" }));

export const shoeName = (shoe) => `${shoe.brand} ${shoe.article}`;
export const shoeImages = (shoe) => [shoe.imgUrl1, shoe.imgUrl2, shoe.imgUrl3, shoe.imgUrl4, shoe.imgUrl5].filter(Boolean);
export const formatPrice = (price) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price);
