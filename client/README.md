# Sole Swap — Client UI

Template desain berdasarkan `README PRD rev.md`, menggunakan React, Vite, dan React Router. Palet hitam-putih dengan Barlow dan Barlow Condensed.

## Menjalankan

```sh
npm ci
npm run dev
```

## Routing di src/App.jsx

| Path | Template |
| --- | --- |
| `/` | Katalog, filter, pagination, dan ilustrasi AI search |
| `/shoes/:shoeId` | Detail, galeri, kondisi/status, aksi pemilik/pembeli |
| `/login` | Login |
| `/register` | Register |
| `/my-shoes` | Listing pribadi, aksi edit/status, dialog hapus |
| `/my-shoes/add` | Tambah listing dan preview 1–5 foto |
| `/my-shoes/:shoeId/edit` | Edit listing contoh milik Raka |
| `/chats` | Inbox |
| `/chats/:chatId` | Ruang chat pembeli/penjual, sold dan arsip read-only |
| `*` | 404 |

Klik kartu katalog untuk menemukan UUID contoh. My Shoes menampilkan listing Raka (ID sepatu berakhiran 002 dan 004). Inbox memiliki contoh peran pembeli, penjual, sold, dan listing dihapus.

Semua halaman terbuka untuk review desain. Belum ada autentikasi, route guard, React Context, global state management, request API, atau socket. Akun Raka hanyalah data contoh untuk variasi tampilan kepemilikan.

State lokal hanya menggerakkan UI: filter/pagination, preview foto, modal, galeri, dan pemilihan contoh loading/empty/error. Submit, ubah status, hapus, dan kirim pesan tidak menyimpan/mengirim data. Hasil AI adalah ilustrasi tetap, bukan pencarian AI sungguhan.

- `src/pages`: template halaman.
- `src/components`: komponen tampilan bersama.
- `src/data/products.js`: mock listing dengan UUID dan field sesuai PRD.
- `src/data/chats.js`: percakapan contoh untuk tampilan.
- `src/index.css`: styling responsif.

Foto memakai Unsplash dan font memakai Google Fonts; keduanya membutuhkan internet. Implementasi fitur dikerjakan terpisah setelah review desain, satu per satu. Socket ditangani anggota tim lain.

## Pemeriksaan

```sh
npm run lint
npm run build
```
