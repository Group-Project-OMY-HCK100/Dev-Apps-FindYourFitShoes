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


## Redux: state autentikasi

Implementasi mengikuti pola contoh di `Downloads/Redux/end`:

- `src/app/store.js`: `configureStore` dengan reducer `auth`.
- `src/features/auth/authSlice.js`: `createSlice`, action pending/success/failed, dan thunk `async/await` untuk login, register, pemeriksaan sesi, serta logout.
- `src/main.jsx`: aplikasi dibungkus `Provider`.
- `App.jsx` dan `AuthForm.jsx`: membaca state memakai `useSelector`, menjalankan action memakai `useDispatch`.

State akun (`user`, `token`, loading, dan error) sekarang berasal dari Redux. Input form, foto, modal, dan state halaman tetap lokal. Token tetap memakai `sessionStorage` dengan key `access_token`. ChatProvider dan koneksi socket tetap menggunakan token serta callback logout dari App.

Pembatalan request dan respons lama diperiksa berdasarkan request ID supaya request sebelum logout/login baru tidak mengubah sesi yang sudah berganti. Reducer hanya memperbarui state; Axios dan browser storage tetap di thunk.

Tes regresi tanpa mendaftarkan akun sungguhan:

```sh
node --test tests/auth-redux.test.mjs
```

Dark/light mode belum dikerjakan pada tahap Redux ini.


## React Context: light dan dark mode

`ThemeProvider` di `src/components/ThemeProvider.jsx` menyimpan pilihan tema melalui `useState` dan membagikan `theme` serta `toggleTheme` menggunakan `ThemeContext`. Navbar mengaksesnya melalui `useTheme()` dari `src/lib/theme-context.js`.

Tombol bulan/matahari mengganti tema untuk semua halaman lewat atribut `data-theme` pada `<html>` dan variabel warna di `src/index.css`. Default tetap light. Pilihan disimpan di `localStorage` dengan key `soleswap.theme`; `public/theme-init.js` menerapkannya sebelum React dimuat agar refresh tidak berkedip ke light mode. Jika penyimpanan browser tidak tersedia, toggle tetap berjalan.

Context tema membungkus `App` di dalam Redux Provider. State autentikasi tetap di Redux dan ChatProvider tetap menangani socket seperti sebelumnya.
