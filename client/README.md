# Sole Swap — Client

React + Vite + React Router. Pola pengerjaan mengikuti I-ProjectMike: Axios langsung di komponen, async/await, input useState/onChange, dan constants/baseUrl.js. Tanpa folder api/utils, custom hook request, Redux, atau React Context.

## Menjalankan

```sh
npm ci
npm run dev
```

API default http://localhost:3000. Untuk URL berbeda, salin .env.example ke .env.local, isi VITE_API_URL, lalu restart Vite. Server dijalankan terpisah oleh tim backend.

## Scope: register dan login saja

Hanya tiga endpoint yang dipakai:

- POST /register: mendaftar dan langsung menerima sesi dari backend.
- POST /login: masuk dengan email/password.
- GET /auth/me: memeriksa token saat refresh.

Token disimpan di sessionStorage (access_token). App.jsx meneruskan akun melalui props. Logout menghapus token; respons 401 saat pengecekan sesi mengembalikan akun menjadi guest. Form memiliki loading, error server, dan pencegahan submit berulang.

Home, katalog, detail, My Shoes, tambah/edit produk, dan chat tetap template dengan data contoh lokal. Tidak ada request sepatu, chat, AI, CRUD, ataupun socket. Data di src/data hanya untuk menampilkan desain; tidak tersimpan di backend.

Guest dapat membuka /, /shoes, dan /shoes/:shoeId. Chat dan halaman pengelolaan sepatu memakai ProtectedRoute. Saat guest membuka chat, diarahkan ke login dan kembali ke tujuan setelah berhasil masuk/register. Link antar login/register mempertahankan tujuan; redirect hanya menerima route internal yang dikenali.

## Routing di App.jsx

- Publik: /, /shoes, /shoes/:shoeId, /login, /register.
- Login: /my-shoes, /my-shoes/add, /my-shoes/:shoeId/edit, /chats, /chats/:chatId.
- Halaman lain: 404.

## Pemeriksaan

```sh
npm run lint
npm run build
```

Uji manual dengan backend aktif: register, login, password salah, email duplikat, klik Chat penjual sebagai guest, refresh halaman privat, dan logout. Tampilan home/detail tetap bisa ditinjau saat backend tidak aktif. Folder server tidak diubah.

j
j
