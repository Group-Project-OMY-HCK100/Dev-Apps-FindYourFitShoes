# Sole Swap — Client

Template marketplace sepatu preloved dengan React, Vite, dan React Router.

Desain menggunakan palet hitam, putih, dan abu-abu dengan katalog retail, filter merek/ukuran, serta layout responsif. Foto produk tetap memakai warna asli. Tipografi memakai Barlow Condensed untuk judul/navigasi dan Barlow untuk teks/form; font dimuat dari Google Fonts dengan fallback lokal.

## Menjalankan

```sh
npm ci
npm run dev
```

## Routing

Semua route didefinisikan di `src/App.jsx`.

| Path | Halaman |
| --- | --- |
| `/` | Home dan katalog |
| `/products/:id` | Detail produk (ID contoh: 1–4) |
| `/login` | Login |
| `/register` | Register |
| `/addproduct` | Tambah produk |
| `/editproduct/:id` | Edit produk (ID contoh: 1–4) |
| `/chat` | Chat penjual dan admin |
| `*` | Halaman tidak ditemukan |

## Struktur

- `src/pages`: halaman untuk setiap route.
- `src/components`: layout, ikon, kartu produk, form autentikasi, dan form produk.
- `src/data/products.js`: data contoh katalog.
- `src/index.css`: desain dan breakpoint responsif.

Belum ada request API, autentikasi, penyimpanan produk, atau chat real-time.
Filter, favorit, dan foto hanya preview lokal dan tidak tersimpan setelah refresh.
Foto contoh memakai Unsplash dan membutuhkan koneksi internet.

## Pemeriksaan

```sh
npm run lint
npm run build
```
