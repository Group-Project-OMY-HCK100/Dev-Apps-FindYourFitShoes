# SoleSwap — README & Engineering Contract (Frontend × Backend)

> **Tujuan:** satu acuan kerja untuk product, frontend, backend, database, integrasi realtime, dan deployment.
> **Kontrak revisi v1.2:** REST tanpa prefix `/api/v1`; upload file sepatu terintegrasi pada `POST /shoes` dan `PUT /shoes/:id` (multipart); AI hanya untuk search.
> **Status:** draft teknis siap review; detail pada §14 masih menunggu sign-off FE+BE. 

## Daftar isi

1. [Ringkasan produk, scope, dan definisi selesai](#1-ringkasan-produk-scope-dan-definisi-selesai)
2. [Alur pengguna dan aturan bisnis](#2-alur-pengguna-dan-aturan-bisnis)
3. [Arsitektur dan struktur proyek](#3-arsitektur-dan-struktur-proyek)
4. [Kontrak frontend: halaman, akses, dan state](#4-kontrak-frontend-halaman-akses-dan-state)
5. [Standar API lintas endpoint](#5-standar-api-lintas-endpoint)
6. [Kontrak database dan data model](#6-kontrak-database-dan-data-model)
7. [REST API contract](#7-rest-api-contract)
8. [Socket.io event contract](#8-socketio-event-contract)
9. [AI search](#9-ai-search)
10. [Validasi, keamanan, dan edge cases](#10-validasi-keamanan-dan-edge-cases)
11. [Konfigurasi dan deployment](#11-konfigurasi-dan-deployment)
12. [Pembagian kerja, kolaborasi, dan change control](#12-pembagian-kerja-kolaborasi-dan-change-control)
13. [Acceptance criteria dan test scenarios](#13-acceptance-criteria-dan-test-scenarios)
14. [Checklist sign-off](#14-checklist-sign-off)
15. [Lampiran: contoh integrasi dan tipe data](#15-lampiran-contoh-integrasi-dan-tipe-data)

---

## 1. Ringkasan produk, scope, dan definisi selesai

### 1.1 Problem statement

SoleSwap adalah marketplace sepatu bekas antarpengguna. Tamu bisa melihat katalog dan detail. User yang login dapat memasang sepatu dan berbicara melalui chat realtime untuk negosiasi harga atau merencanakan COD. AI **hanya** membantu pencarian berdasarkan bahasa natural.

### 1.2 Jenis aktor

| Aktor | Hak utama |
|---|---|
| **Guest** | Melihat katalog/detail, search biasa dan AI search, login/register |
| **Authenticated user** | Semua hak Guest, membuat/mengelola listing sendiri, memulai chat pada listing orang lain, melihat inbox dan berkirim pesan |
| **Seller dalam konteks listing** | Pemilik `shoe.userId`; berhak edit, hapus, ubah status; menerima chat calon pembeli |
| **Buyer dalam konteks chat** | `chat.buyerId`; memulai chat dengan pemilik listing orang lain |

Tidak ada role RBAC `BUYER` vs `SELLER` yang tersimpan di tabel user. Peran berasal dari kepemilikan listing dan chat.

### 1.3 Prioritas scope

| Prioritas | Fitur | Kriteria MVP |
|---|---|---|
| **Must** | Register, login, logout, auth guard, redirect kembali | Tidak kehilangan tujuan chat setelah autentikasi |
| **Must** | Katalog publik, detail publik, pagination | Card harga, foto, kondisi, sold badge |
| **Must** | `My Shoes`, create/edit/status/delete | Hanya pemilik boleh mengubah |
| **Must** | Upload 1–5 file via POST/PUT sepatu (Cloudinary) | Gambar muncul pada katalog/detail |
| **Must** | Chat list/inbox dan chat per `(shoe, buyer)` | Historis persisten; pesan dua arah realtime |
| **Must** | Unread badge dan typing | Sinkron pada dua browser; count tidak mengganda |
| **Must** | Sold broadcast | Halaman katalog dan detail berubah tanpa refresh |
| **Must** | AI natural-language search | Minimal 3 query demo relevan, memiliki fallback |
| **Should** | Presence online | Dikerjakan setelah Must selesai |
| **Nice** | Wishlist, dark mode, manual advanced filters | Tidak menghambat demo |
| **Out of scope** | Payment, order checkout, kurir, escrow, review, autentikasi sepatu, aplikasi native | Tidak boleh terselip menjadi blocker MVP |

### 1.4 Success metrics demo

1. Pesan teks tiba pada browser peserta lain **target < 1 detik** pada kondisi jaringan demo yang stabil; ini target acceptance, bukan SLA produksi.
2. Status listing `sold` tampil di browser penonton tanpa refresh.
3. Minimal **3 skenario AI search** menghasilkan listing masuk akal atau fallback yang jelas.
4. Percakapan tetap ada setelah refresh/login ulang.
5. Alur lengkap Guest → Login/Register → Chat dan Seller → Create → Mark Sold berhasil di deployment publik.

---

## 2. Alur pengguna dan aturan bisnis

### 2.1 Guest melihat katalog dan detail

1. Browser membuka **route React** `/`; frontend memanggil **REST** `GET /shoes` tanpa JWT.
2. Homepage menampilkan card (foto utama, brand + article, harga rupiah, ukuran EU, status).
3. Klik card membuka **route React** `/shoes/:shoeId`; frontend memanggil **REST** `GET /shoes/:id` tanpa JWT.
4. Sepatu dengan status `sold` **tetap boleh dilihat**, tetapi tombol membuat chat baru dinonaktifkan.
5. Pemilik listing yang sedang login melihat tombol **Edit** sebagai pengganti `Chat Seller`.

### 2.2 Guest klik `Chat Seller`

1. Klik `Chat Seller` pada listing `available`.
2. Jika belum login, frontend menyimpan `pendingChatShoeId` dari **klik tombol yang nyata** di `sessionStorage`, kemudian redirect ke `/login?returnTo=%2Fshoes%2F<shoeId>` (URL-encoded dari `/shoes/<shoeId>`). Link register mempertahankan `returnTo`.
3. Setelah login/register berhasil, frontend menerima `returnTo` hanya jika merupakan **path internal allowlisted** untuk mencegah open redirect; jangan memakai nilai URL arbitrer.
4. Jika `pendingChatShoeId` valid, cocok dengan ID pada path tujuan, dan belum diproses, frontend mengirim `POST /chats` dengan `{ "shoeId": "..." }`, lalu menghapus intent tersebut (sukses maupun gagal).
5. Jika chat sudah ada, server mengembalikan chat yang sama; frontend membuka `/chats/:chatId`.
6. Jika listing sudah sold/soft-deleted selama proses login dan chat belum ada, tampilkan pesan dan kembalikan ke detail/katalog.
7. Hanya **klik tombol** yang menyimpan intent, **bukan query URL saja**, yang boleh memicu pembuatan chat otomatis sesudah login.

### 2.3 Seller menjual dan mengelola sepatu

1. User login → `/my-shoes` → klik `Jual Sepatu` → `/my-shoes/add`.
2. Isi brand, article/model, kategori, kondisi, ukuran, warna, deskripsi, harga, dan pilih 1–5 file gambar.
3. Frontend mengirim **satu request multipart** `POST /shoes` berisi field listing dan file `images` (berulang). Backend upload ke Cloudinary dan menyimpan URL di `imgUrl1`–`imgUrl5`; **tidak ada endpoint upload terpisah**.
4. Seller mengedit listing melalui halaman `/my-shoes/:shoeId/edit`, yang mengirim `PUT /shoes/:id` multipart dan mempertahankan URL gambar lama dengan field `retainedImageUrls` (lihat §7.4–7.5).
5. Seller dapat menandai status `sold` atau mengembalikannya ke `available` melalui `PATCH /shoes/:id/status`.
6. Seller dapat soft-delete listing. Listing hilang dari katalog, tetapi riwayat chat lama tetap tersimpan.

### 2.4 Buyer dan seller bernegosiasi

1. Buyer memulai chat dari detail listing; server memastikan listing bukan miliknya sendiri.
2. Backend menjamin satu ruang untuk satu pasangan `(shoeId, buyerId)`.
3. Pesan hanya dapat dikirim oleh buyer atau seller pada chat terkait.
4. Pesan disimpan di DB **sebelum** broadcast. Pesan tanpa ACK tidak dianggap terkirim final.
5. Unread dihitung oleh server; chat aktif ditandai read dan count disinkronkan.
6. Pada halaman chat, **seller melihat tombol `Tandai Terjual`** yang memanggil `PATCH /shoes/:id/status` dengan `{ "status": "sold" }` setelah kesepakatan. Buyer tidak melihat tombol tersebut.
7. Saat seller mengubah status menjadi `sold`, seluruh penonton katalog/detail dan chat terkait menerima update.
8. `sold` **bukan** transaksi berhasil atau bukti pembayaran; negosiasi COD berlangsung di chat secara mandiri.

### 2.5 Aturan khusus

- User **tidak bisa chat dengan dirinya sendiri**.
- Chat baru tidak bisa dibuat pada listing `sold` atau terhapus (`409/404`).
- Chat lama tetap bisa dibuka; chat lama yang status sepatunya `sold` diberi banner "Sepatu sudah terjual" dan **masih bisa dipakai untuk koordinasi**. Setelah **soft delete**, histori chat lama tetap bisa dibaca tetapi menjadi **read-only** (tidak boleh kirim pesan baru).
- Jika dua request `POST /chats` bersamaan dari buyer yang sama, database constraint mencegah duplikasi.
- Status sepatu hanya bisa diganti oleh pemilik; teks negosiasi tidak otomatis mengganti harga `shoe.price`.
- Jangan tampilkan email/password/nomor telepon pengguna lain dari endpoint publik. **Kota/lokasi seller tidak disimpan sebagai field pada model MVP ini**; alamat lengkap COD tidak perlu disimpan di database dan boleh disepakati langsung di chat.

---

## 3. Arsitektur dan struktur proyek

### 3.1 Stack utama

| Layer | Rencana |
|---|---|
| Frontend | React + Vite + React Router + React Context |
| REST/backend | Node.js + Express |
| Realtime | Socket.io server/client |
| Database | PostgreSQL |
| ORM/migrations | **Sequelize** (rencana implementasi yang dicantumkan pada kontrak ini; tim mengonfirmasi saat sign-off) |
| Image storage | Cloudinary |
| AI | LLM provider dipanggil hanya dari backend |
| Authentication | JWT, email + bcrypt-hashed password |
| Deploy frontend | Vercel/Netlify atau setara |
| Deploy backend | Platform Node long-running dengan WebSocket persisten |

### 3.2 Arsitektur konseptual

```mermaid
flowchart LR
    U[Browser / React SPA] -->|REST HTTPS| E[Express API]
    U <-->|Socket.io WSS| S[Realtime server]
    E --> P[(PostgreSQL)]
    S --> P
    E --> C[Cloudinary]
    E --> A[LLM provider]
    S -. Same Node app / service layer .- E
```

REST adalah sumber data awal, mutasi listing sekaligus upload foto, auth, AI, serta histori chat. Socket.io digunakan untuk peristiwa realtime; PostgreSQL adalah sumber kebenaran permanen.

### 3.3 Struktur repo yang disarankan

```text
soleswap/
├── README.md                  # Kontrak ini
├── client/
│   ├── src/
│   │   ├── app/                # Router, providers
│   │   ├── api/                # axios/fetch services berbasis kontrak
│   │   ├── contexts/           # AuthContext, SocketContext, ChatContext, ListingContext
│   │   ├── components/         # Navbar, ListingCard, ChatWindow, dll.
│   │   ├── pages/              # Route pages
│   │   ├── hooks/
│   │   └── utils/
│   └── .env.example
├── server/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js            # HTTP + Socket.io attachment
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── sockets/
│   │   ├── validators/
│   │   └── utils/
│   ├── tests/
│   └── .env.example
└── docs/
    ├── decisions.md           # Opsional: ADR/change log
    └── openapi.yaml           # Disarankan dibuat/di-sync setelah sign-off
```

Struktur folder dapat disesuaikan; **nama API, field, event, semantik, dan aturan akses** tidak boleh berubah sepihak.

---

## 4. Kontrak frontend: halaman, akses, dan state

### 4.1 Halaman dan routing

| Route React | Akses | Fungsi utama | API utama |
|---|---|---|---|
| `/` | **Publik** | Homepage katalog + AI search | `GET /shoes`, `POST /ai/search` |
| `/shoes/:shoeId` | **Publik** | Detail, foto, harga, kondisi, `Chat Seller` | `GET /shoes/:id`, `POST /chats` saat klik |
| `/login` | Publik | Login; dukung `returnTo` | `POST /login` |
| `/register` | Publik | Register; dukung `returnTo` | `POST /register` |
| `/my-shoes` | **Login** | Daftar listing milik user | `GET /shoes/my-shoes` |
| `/my-shoes/add` | **Login** | Form buat listing | `POST /shoes` |
| `/my-shoes/:shoeId/edit` | **Login + owner** | Form edit, ubah status, hapus | `GET /shoes/:id`, `PUT /shoes/:id`, `PATCH /shoes/:id/status`, `DELETE /shoes/:id` |
| `/chats` | **Login** | Inbox seluruh chat buyer/seller | `GET /chats` |
| `/chats/:chatId` | **Login + peserta** | Ruang chat realtime | `GET /chats/:id`, `GET /chats/:id/messages`, Socket.io |
| `*` | Publik | 404 aplikasi | — |


### 4.2 Navigation dan auth guard

- Header Guest: logo, katalog/search, login, register.
- Header Login: logo, katalog/search, `Jual Sepatu`, `My Shoes`, `Inbox` + unread badge, logout.
- Hanya halaman privat menggunakan `ProtectedRoute`; **jangan melindungi seluruh aplikasi**.
- Ketika endpoint privat mendapat `401`, simpan URL tujuan, hapus sesi lokal, arahkan ke login.
- User login yang membuka `/login` normal dapat diarahkan ke homepage, kecuali sedang menyelesaikan `returnTo`.
- Owner tidak boleh melihat tombol `Chat Seller` untuk sepatu sendiri. Untuk seller tampilkan `Edit / Mark Sold`.
- Tampilkan loading/empty/error states pada katalog, detail, listing pribadi, inbox, dan chat.
- Tombol yang mengirim mutasi dinonaktifkan saat pending agar tidak memicu double-submit; backend tetap bertanggung jawab atas idempotency relevan.

### 4.3 Context dan tanggung jawab

| Context | Data minimal | Catatan |
|---|---|---|
| `AuthContext` | `user`, `token`, `isAuthenticated`, `login`, `register`, `logout` | Satu sumber status login |
| `SocketContext` | `socket`, `connected`, `connect`, `disconnect` | Jangan buat socket baru setiap render |
| `ChatContext` | `chats`, `messagesByChatId`, `unreadTotal`, `typingByChatId`, `activeChatId` | Dedup pesan berdasarkan `message.id`/`clientMessageId` |
| `ListingContext` | `shoes`, `filters`, `searchResults`, `loading`, `error` | Terapkan `listing:created`, `listing:updated`, `listing:status`, dan `listing:deleted` pada cache/refetch |

### 4.4 UI states yang disepakati

- **Status sold:** badge jelas, `Chat Seller` tidak dapat memulai chat baru; histori chat lama tetap ada.
- **Chat:** `sending` (optimistic), `sent` (ACK sukses), `failed` (ACK timeout/error dan bisa retry menggunakan clientMessageId sama). Seller mendapat tombol `Tandai Terjual` pada ChatWindow; tombol disabled saat pending dan untuk listing yang sudah sold/deleted.
- **AI:** `idle`, `loading`, `success`, `fallback`, `error`; fallback tidak dianggap zero-result.
- **Gambar:** preview sebelum submit, progress/pending saat request multipart ke server, error Cloudinary, serta kemampuan mempertahankan/menghapus foto lama pada form edit.
- **Inbox:** tampilkan sepatu terkait, lawan bicara, pesan terakhir, waktu relatif, dan unread badge.

---

## 5. Standar API lintas endpoint

### 5.1 Base URL dan versi

```text
LOCAL REST:   http://localhost:3000
PROD REST:    https://<api-host>
SOCKET LOCAL: http://localhost:3000       # Socket.io, tanpa prefix route REST
```

- REST menggunakan JSON, **kecuali `POST /shoes` dan `PUT /shoes/:id` yang menerima `multipart/form-data`**. Tidak ada endpoint upload terpisah.
- ID: **UUID string** dari database, bukan integer sequence.
- Waktu: ISO 8601 UTC, contoh `2026-10-13T09:30:00.000Z`.
- Mata uang: **IDR**; harga disimpan sebagai integer rupiah (tanpa `Rp`, titik, atau desimal).
- JSON field menggunakan `camelCase`; kolom database boleh `snake_case` tetapi serializer API harus konsisten.
- Array kosong harus `[]`, bukan `null`, kecuali kolom memang nullable.

### 5.2 HTTP headers

```http
Content-Type: application/json   # hanya pada request JSON
Authorization: Bearer <JWT>   # hanya untuk route yang membutuhkan auth
```

Untuk request `FormData`, **jangan set `Content-Type` secara manual**: browser harus mengisi boundary `multipart/form-data`. Token tidak dikirim melalui query string. API key provider/cloud storage tidak dikirim ke frontend. `CORS` harus mengizinkan origin client dev dan produksi yang dikonfigurasi, bukan sembarang origin secara default pada production.

### 5.3 Envelope response yang wajib diikuti

**Success — single object**

```json
{
  "success": true,
  "data": { "id": "5f9ce75b-e076-4a80-b619-c5e8bb401001" }
}
```

**Success — paginated list**

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "limit": 12, "totalItems": 0, "totalPages": 0 }
}
```

**Error — semua endpoint**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data tidak valid",
    "details": [{ "field": "price", "message": "price harus lebih besar dari 0" }]
  }
}
```

Pengecualian: `DELETE` berhasil memakai `204 No Content` tanpa body. Jangan pernah mengirim stack trace/password/token melalui error response.

### 5.4 Status code dan error code

| HTTP | Kapan digunakan | Contoh `error.code` |
|---|---|---|
| `200` | Data berhasil, update, login, chat sudah ada | — |
| `201` | Register, create listing (termasuk upload), chat baru | — |
| `204` | Delete selesai | — |
| `400` | JSON/query malformed | `BAD_REQUEST` |
| `401` | Token hilang/kedaluwarsa/tidak sah | `UNAUTHORIZED`, `TOKEN_EXPIRED` |
| `403` | Login tapi bukan owner/peserta atau chat diri sendiri | `FORBIDDEN`, `SELF_CHAT_NOT_ALLOWED` |
| `404` | ID tidak ada atau listing dihapus | `SHOE_NOT_FOUND`, `CHAT_NOT_FOUND` |
| `409` | Unik konflik/state tidak mengizinkan operasi | `EMAIL_ALREADY_EXISTS`, `SHOE_NOT_AVAILABLE` |
| `413` | Gambar/file terlalu besar | `FILE_TOO_LARGE` |
| `415` | Format file tidak didukung | `UNSUPPORTED_MEDIA_TYPE` |
| `422` | Body dikenali tetapi melanggar aturan validasi | `VALIDATION_ERROR` |
| `429` | Rate limit | `RATE_LIMITED` |
| `500` | Kesalahan tak terduga | `INTERNAL_SERVER_ERROR` |
| `503` | Provider layanan yang diperlukan gagal tanpa fallback | `SERVICE_UNAVAILABLE` |

Gunakan `422` konsisten untuk validasi field. `404` disarankan untuk private resource yang tidak boleh diungkap keberadaannya kepada bukan peserta, daripada mengonfirmasi bahwa private resource tersebut ada.

### 5.5 Paging, sorting, dan filtering

- Katalog/listing/inbox: `page` mulai **1**, `limit` default **12**, maksimum **50**.
- `totalItems` dan `totalPages` dihitung setelah filter diterapkan.
- Sorting default: `createdAt DESC`, lalu `id DESC` agar deterministik.
- Riwayat pesan memakai **cursor** `before` atau `after` (bukan page), `limit` default 30 maksimum 100.
- `before`/`after` memakai **message ID** valid dan mutually exclusive. Semua response `data` pesan tetap berurutan **terlama → terbaru** agar mudah dirender di chat.


---

## 6. Kontrak database dan data model

### 6.1 ERD (logical model)

```mermaid
erDiagram
    USERS ||--o{ SHOES : owns
    USERS ||--o{ CHATS : starts_as_buyer
    SHOES ||--o{ CHATS : has
    USERS ||--o{ MESSAGES : sends
    CHATS ||--o{ MESSAGES : contains

    USERS {
      uuid id PK
      varchar name
      citext email UK
      varchar password_hash
      timestamp created_at
      timestamp updated_at
    }
    SHOES {
      uuid id PK
      uuid user_id FK
      varchar brand
      varchar article
      varchar category
      varchar condition
      decimal size
      varchar color
      text description
      integer price
      varchar status
      varchar img_url_1
      varchar img_url_2
      varchar img_url_3
      varchar img_url_4
      varchar img_url_5
      timestamp deleted_at
      timestamp created_at
      timestamp updated_at
    }
    CHATS {
      uuid id PK
      uuid shoe_id FK
      uuid buyer_id FK
      timestamp last_message_at
      timestamp created_at
    }
    MESSAGES {
      uuid id PK
      uuid chat_id FK
      uuid sender_id FK
      uuid client_message_id
      text text
      timestamp read_at
      timestamp created_at
    }
```

**Catatan:** Kolom PostgreSQL ditulis `snake_case`, tetapi serializer REST/Socket mengirim JSON `camelCase`. `CITEXT` atau unique functional index `lower(email)` dipakai agar email unik secara case-insensitive. `sellerId` di chat diperoleh dari `chat.shoeId → shoes.userId`; tidak perlu kolom terpisah.

Untuk dapat menghapus gambar Cloudinary dengan aman, **disarankan** menyimpan lima kolom internal `img_public_id_1`–`img_public_id_5` berdampingan dengan URL terkait (nullable; tidak dikirim ke client). Jika tim menunda penyimpanan public ID atau cleanup Cloudinary pada MVP, catat bahwa objek foto lama dapat menjadi orphan; jangan menebak `public_id` dari URL sembarangan. **Tidak ada tabel `shoe_images` maupun pending image** dalam desain ini.

### 6.2 Tabel, constraints, dan indeks

| Tabel | Field wajib dan aturan | Constraint penting |
|---|---|---|
| `users` | `id`, `name`, `email`, `password_hash`, `created_at`, `updated_at` | Email unik case-insensitive; password hanya hash bcrypt |
| `shoes` | `id`, `user_id`, `brand`, `article`, `category`, `condition`, `size`, `color`, `description`, `price`, `status`, `img_url_1`, timestamps; `img_url_2`–`img_url_5` dan `deleted_at` nullable | `price > 0`, `status IN ('available','sold')`, `img_url_1` NOT NULL, owner immutable, FK user |
| `chats` | `id`, `shoe_id`, `buyer_id`, `last_message_at` nullable, `created_at` | **UNIQUE(shoe_id, buyer_id)**; buyer != owner divalidasi server |
| `messages` | `id`, `chat_id`, `sender_id`, `client_message_id`, `text`, `read_at` nullable, `created_at` | **UNIQUE(sender_id, client_message_id)** untuk mencegah pesan duplikat saat retry |

Indeks minimum: `shoes(user_id, created_at DESC)`, `shoes(status, created_at DESC)` untuk listing tidak terhapus, `chats(buyer_id, last_message_at DESC)`, `chats(shoe_id)`, `messages(chat_id, created_at DESC, id DESC)`, serta indeks untuk unread `(chat_id, read_at)` sesuai kebutuhan query. Gunakan migration Sequelize untuk constraint dan indeks.

### 6.3 Enumerasi dan validasi listing

| Field | Type | Wajib | Aturan default |
|---|---|---|---|
| `brand` | string | Ya | 2–60 karakter, contoh `Nike` |
| `article` | string | Ya | 2–120 karakter, contoh `Air Max 90` |
| `category` | enum | Ya | `running`, `casual`, `basketball`, `formal`, `sneakers`, `other` |
| `condition` | enum | Ya | `like_new`, `good`, `fair` |
| `size` | number | Ya | 35–50, kelipatan 0,5, satuan EU |
| `color` | enum | Ya | `black`, `white`, `gray`, `red`, `blue`, `green`, `yellow`, `brown`, `beige`, `purple`, `pink`, `orange`, `neon`, `multicolor`, `other` |
| `description` | string | Ya | 10–2.000 karakter; render sebagai plain text |
| `price` | integer | Ya | 1–100.000.000 IDR (rupiah utuh) |
| `images` | file[] pada multipart | Create: ya | **1–5 file**, nama field multipart `images` diulang, max 5 MB/file; hanya JPEG/PNG/WebP |
| `retainedImageUrls` | JSON-string `string[]` pada multipart | Update: ya | URL gambar lama yang ingin dipertahankan, **harus cocok** dengan URL listing saat ini; array bisa `[]` bila seluruh gambar diganti |
| `imgUrl1`–`imgUrl5` | `string | null` pada response | Output saja | URL Cloudinary hasil upload; `imgUrl1` foto utama, `imgUrl2`–`imgUrl5` nullable |
| `status` | enum | Create: server | **Server menetapkan `available`**; ubah hanya melalui endpoint status |

- Request `POST /shoes` dan `PUT /shoes/:id` adalah **multipart**, sehingga `size` dan `price` dikirim sebagai string angka lalu dikonversi/validasi di backend. Tidak ada `imgUrl*`, `imageIds`, atau URL gambar arbitrer yang diterima sebagai file baru.
- Pada `PUT`, susunan gambar hasil akhir: **urutan `retainedImageUrls` lalu urutan file `images` baru**. Jumlah akhir harus 1–5; URL retained tidak boleh duplikat; hanya URL yang saat ini melekat pada listing tersebut yang valid.
- Label UI enum: `like_new` = "Seperti baru", `good` = "Baik", `fair` = "Cukup". Bila ingin mendukung ukuran UK/US/anak, lebih dari satu warna, atau limit harga lain, revisi kontrak bersama terlebih dahulu.
- `deleted_at IS NOT NULL` berarti soft-deleted; listing tidak tersedia di katalog/AI search dan tidak menerima chat/pesan baru. Riwayat chat tetap ada, read-only.
- Cloudinary dan PostgreSQL **tidak berbagi transaksi**. Jika upload berhasil tetapi transaksi DB gagal, backend memakai public ID yang diperoleh dari respons upload untuk cleanup objek Cloudinary baru secara best-effort. Setelah update DB sukses, gambar lama yang dilepas dibersihkan best-effort **hanya apabila public ID-nya tersimpan**; kegagalan cleanup tidak mengubah hasil listing.

### 6.4 Model JSON kanonis

**UserSelf** — hanya user sendiri setelah auth:

```json
{
  "id": "10000000-0000-4000-8000-000000000002",
  "name": "Dimas",
  "email": "dimas@example.com",
  "createdAt": "2026-10-13T09:00:00.000Z"
}
```

**UserPublic** — pada listing/chat (tanpa email):

```json
{ "id": "10000000-0000-4000-8000-000000000002", "name": "Dimas" }
```

**ShoeSummary** — model card katalog dan hasil AI (tanpa deskripsi dan URL foto 2–5):

```json
{
  "id": "20000000-0000-4000-8000-000000000001",
  "seller": { "id": "10000000-0000-4000-8000-000000000002", "name": "Dimas" },
  "imgUrl1": "https://res.cloudinary.com/demo/image/upload/v1/shoes/air-max-1.jpg",
  "brand": "Nike",
  "article": "Air Max 90",
  "category": "casual",
  "condition": "good",
  "size": 42,
  "color": "black",
  "price": 450000,
  "currency": "IDR",
  "status": "available",
  "createdAt": "2026-10-13T09:00:00.000Z",
  "updatedAt": "2026-10-13T09:00:00.000Z"
}
```

**ShoeDetail** — seluruh field `ShoeSummary` + `description` dan URL foto kedua s.d. kelima (`null` bila tidak ada):

```json
{
  "id": "20000000-0000-4000-8000-000000000001",
  "seller": { "id": "10000000-0000-4000-8000-000000000002", "name": "Dimas" },
  "imgUrl1": "https://res.cloudinary.com/demo/image/upload/v1/shoes/air-max-1.jpg",
  "imgUrl2": "https://res.cloudinary.com/demo/image/upload/v1/shoes/air-max-2.jpg",
  "imgUrl3": null,
  "imgUrl4": null,
  "imgUrl5": null,
  "brand": "Nike",
  "article": "Air Max 90",
  "category": "casual",
  "condition": "good",
  "size": 42,
  "color": "black",
  "description": "Kondisi baik, sol masih bagus, jarang dipakai.",
  "price": 450000,
  "currency": "IDR",
  "status": "available",
  "createdAt": "2026-10-13T09:00:00.000Z",
  "updatedAt": "2026-10-13T09:00:00.000Z"
}
```

**Message** — sama untuk respons REST, ACK socket, `message:new`:

```json
{
  "id": "50000000-0000-4000-8000-000000000001",
  "chatId": "40000000-0000-4000-8000-000000000001",
  "senderId": "10000000-0000-4000-8000-000000000001",
  "clientMessageId": "60000000-0000-4000-8000-000000000001",
  "text": "Halo, boleh nego jadi Rp400.000?",
  "readAt": null,
  "createdAt": "2026-10-13T09:15:00.000Z"
}
```

**ChatSummary / ChatDetail** — pada MVP `ChatDetail` sama dengan `ChatSummary`:

```json
{
  "id": "40000000-0000-4000-8000-000000000001",
  "shoe": {
    "id": "20000000-0000-4000-8000-000000000001",
    "brand": "Nike",
    "article": "Air Max 90",
    "imgUrl1": "https://res.cloudinary.com/demo/image/upload/v1/shoes/air-max-1.jpg",
    "status": "available",
    "isDeleted": false
  },
  "buyer": { "id": "10000000-0000-4000-8000-000000000001", "name": "Raka" },
  "seller": { "id": "10000000-0000-4000-8000-000000000002", "name": "Dimas" },
  "otherParticipant": { "id": "10000000-0000-4000-8000-000000000002", "name": "Dimas" },
  "lastMessageAt": "2026-10-13T09:15:00.000Z",
  "lastMessage": {
    "id": "50000000-0000-4000-8000-000000000001",
    "senderId": "10000000-0000-4000-8000-000000000001",
    "text": "Halo, boleh nego jadi Rp400.000?",
    "createdAt": "2026-10-13T09:15:00.000Z"
  },
  "unreadCount": 0,
  "createdAt": "2026-10-13T09:10:00.000Z"
}
```

`otherParticipant` dan `unreadCount` dihitung **untuk user pemanggil**; jika user pemanggil buyer, `otherParticipant = seller`, dan sebaliknya. `lastMessage` serta `lastMessageAt` boleh `null` pada chat baru. Pada listing soft-deleted, ringkasan shoe tetap tersedia di histori chat dengan `isDeleted: true`.

## 7. REST API contract

### 7.1 Matriks endpoint ringkas

Semua path berikut relatif terhadap base URL (mis. `http://localhost:3000`). **Tidak menggunakan `/api/v1`**.

| Method | Endpoint | Auth | Fungsi |
|---|---|---|---|
| POST | `/register` | Publik | Daftar akun dan login otomatis |
| POST | `/login` | Publik | Login |
| GET | `/auth/me` | Login | Profil akun aktif |
| GET | `/shoes` | Publik | Katalog sepatu berhalaman |
| GET | `/shoes/my-shoes` | Login | Listing milik user (**route sebelum** `/shoes/:id`) |
| GET | `/shoes/:id` | Publik | Detail sepatu |
| POST | `/shoes` | Login | Buat listing + upload gambar (multipart) |
| PUT | `/shoes/:id` | Owner | Ganti detail listing + kelola gambar (multipart) |
| PATCH | `/shoes/:id/status` | Owner | Ubah status sold/available |
| DELETE | `/shoes/:id` | Owner | Soft delete |
| POST | `/chats` | Login | Get-or-create chat untuk listing |
| GET | `/chats` | Login | Inbox buyer + seller |
| GET | `/chats/:id` | Peserta | Metadata chat |
| GET | `/chats/:id/messages` | Peserta | Riwayat pesan + cursor |
| PATCH | `/chats/:id/read` | Peserta | Tandai pesan masuk sudah dibaca |
| POST | `/ai/search` | Publik | Natural-language AI search + fallback |
| GET | `/health` | Publik | Health check ringan |

**Tidak ada endpoint terpisah untuk upload foto dan tidak ada endpoint REST mengirim pesan.** Pesan dikirim via Socket.io `message:send`. Jika nantinya diperlukan fallback HTTP, tambahkan kontrak baru secara eksplisit.

### 7.2 Auth

#### `POST /register` — `201 Created` (Publik)

Request (`application/json`):

```json
{
  "name": "Raka",
  "email": "raka@example.com",
  "password": "KataSandiRahasia123"
}
```

Validasi: `name` 2–80 karakter, email valid dan unik case-insensitive, password 8–72 **byte UTF-8** (bcrypt). Email dinormalisasi `trim + lowercase`; hash password hanya disimpan di server.

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "10000000-0000-4000-8000-000000000001",
      "name": "Raka",
      "email": "raka@example.com",
      "createdAt": "2026-10-13T09:00:00.000Z"
    },
    "accessToken": "<JWT_STRING>",
    "tokenType": "Bearer",
    "expiresIn": 86400
  }
}
```

Errors: `409 EMAIL_ALREADY_EXISTS`, `422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

#### `POST /login` — `200 OK` (Publik)

Request:

```json
{ "email": "raka@example.com", "password": "KataSandiRahasia123" }
```

Response **identik** dengan bentuk register (`user`, `accessToken`, `tokenType`, `expiresIn`). Tidak pernah mengembalikan password. Gunakan pesan umum bila email/password salah agar tidak mengungkap apakah alamat email terdaftar.

Errors: `401 INVALID_CREDENTIALS`, `422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

#### `GET /auth/me` — `200 OK` (Login)

```json
{
  "success": true,
  "data": {
    "id": "10000000-0000-4000-8000-000000000001",
    "name": "Raka",
    "email": "raka@example.com",
    "createdAt": "2026-10-13T09:00:00.000Z"
  }
}
```

**Logout:** pada MVP JWT stateless; client menghapus token dan user state, kemudian disconnect socket. Tidak ada server-side token revocation/logout-all-sessions. Masa berlaku JWT default 24 jam. Untuk demo token disimpan di `sessionStorage` dan memori; web storage rentan XSS, sehingga jangan merender HTML tidak tepercaya.

### 7.3 Katalog dan My Shoes

#### `GET /shoes` — `200 OK` (Publik)

Contoh:

```http
GET /shoes?page=1&limit=12&status=all&brand=Nike&size=42&sort=newest
```

| Query | Default | Aturan |
|---|---|---|
| `page` | `1` | Integer >= 1 |
| `limit` | `12` | 1–50 |
| `status` | `all` | `available`, `sold`, `all` (selain soft-deleted) |
| `brand` | tidak ada | Case-insensitive partial match |
| `size` | tidak ada | Ukuran EU 35–50 dengan kelipatan 0,5 |
| `category` | tidak ada | Enum kategori yang berlaku |
| `q` | tidak ada | Pencarian teks biasa pada brand/article/description; **bukan AI** |
| `sort` | `newest` | `newest`, `price_asc`, `price_desc` |

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "20000000-0000-4000-8000-000000000001",
      "seller": { "id": "10000000-0000-4000-8000-000000000002", "name": "Dimas" },
      "imgUrl1": "https://res.cloudinary.com/demo/image/upload/v1/shoes/air-max-1.jpg",
      "brand": "Nike",
      "article": "Air Max 90",
      "category": "casual",
      "condition": "good",
      "size": 42,
      "color": "black",
      "price": 450000,
      "currency": "IDR",
      "status": "available",
      "createdAt": "2026-10-13T09:00:00.000Z",
      "updatedAt": "2026-10-13T09:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 12, "totalItems": 1, "totalPages": 1 }
}
```

Default `status=all` agar sold tetap terlihat dengan badge. UI dapat menawarkan toggle `Tersedia saja` (`status=available`).

#### `GET /shoes/my-shoes` — `200 OK` (Login)

Query: `page`, `limit`, `status=all|available|sold`, `sort`. Bentuk respons **sama dengan `GET /shoes`**, tetapi hanya item dengan `shoes.user_id = req.user.id` dan `deleted_at IS NULL`. Route ini **wajib dideklarasikan sebelum `GET /shoes/:id`**.

#### `GET /shoes/:id` — `200 OK` (Publik)

Response: `{ "success": true, "data": ShoeDetail }` sesuai §6.4. Listing soft-deleted mengembalikan `404 SHOE_NOT_FOUND`; listing sold tetap `200` dengan `status: "sold"`.

### 7.4 Gambar terintegrasi pada create/edit (tanpa upload endpoint)

Pengiriman file **langsung** dilakukan melalui `POST /shoes` atau `PUT /shoes/:id` dengan `multipart/form-data`.

- Nama file field: `images` (diulang untuk beberapa gambar). **Create**: 1–5 file; **edit**: 0–5 file baru, tetapi jumlah final termasuk foto yang dipertahankan harus 1–5.
- MIME yang diizinkan: `image/jpeg`, `image/png`, `image/webp`; backend memeriksa isi/magic bytes, tidak hanya ekstensi.
- Ukuran maksimal **5 MB per file**; file selain tipe yang diperbolehkan ditolak.
- Cloudinary diakses **backend** menggunakan kredensial server. React tidak menerima Cloudinary secret dan tidak mengirim URL baru arbitrer.
- Backend memproses `price` dan `size` yang berasal dari multipart sebagai string angka dan memvalidasinya sebelum menyimpan.
- **Edit**: field `retainedImageUrls` **wajib** berupa JSON-string array berisi URL yang saat ini tersimpan pada listing tersebut, dalam urutan yang ingin dipertahankan. Semua URL harus diotorisasi dengan membandingkan ke milik shoe yang sedang di-edit, bukan menerima URL dari listing lain. Foto baru dari field `images` ditempatkan **setelah** URL yang dipertahankan, menurut urutan file.
- Saat edit tanpa ubah gambar, kirim seluruh URL gambar lama pada `retainedImageUrls` dan **tidak perlu mengirim file baru**. Saat replace total, kirim `retainedImageUrls: "[]"` dan minimal satu file baru.
- Jika validasi atau upload gagal, jangan menyimpan perubahan DB sebagian. Apabila Cloudinary terlanjur menerima beberapa file baru, server melakukan cleanup best-effort. Setelah DB sukses, foto lama yang dibuang dibersihkan best-effort jika public ID Cloudinary disimpan secara internal (sesuai keputusan database §6.1).

### 7.5 CRUD listing

#### `POST /shoes` — `201 Created` (Login)

Header: `Authorization: Bearer <JWT>`. Body: **`multipart/form-data`**. Daftar form field:

| Key | Contoh value | Jenis |
|---|---|---|
| `brand` | `Nike` | text |
| `article` | `Air Max 90` | text |
| `category` | `casual` | text enum |
| `condition` | `good` | text enum |
| `size` | `42` | text → number |
| `color` | `black` | text enum |
| `description` | `Kondisi baik, jarang dipakai.` | text |
| `price` | `450000` | text → integer |
| `images` | `[File air-max-front.jpg]` | file, diulang 1–5 kali |

Contoh frontend dengan **FormData** (jangan set `Content-Type` manual):

```js
const formData = new FormData();
formData.append("brand", "Nike");
formData.append("article", "Air Max 90");
formData.append("category", "casual");
formData.append("condition", "good");
formData.append("size", "42");
formData.append("color", "black");
formData.append("description", "Kondisi baik, jarang dipakai.");
formData.append("price", "450000");
selectedFiles.forEach((file) => formData.append("images", file));

await fetch(`${import.meta.env.VITE_API_URL}/shoes`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: formData
});
```

Server menetapkan `status: "available"`. Response: `201` dengan `{ "success": true, "data": ShoeDetail }` sesuai §6.4. Backend memvalidasi field/file, mengunggah gambar ke Cloudinary, menyimpan `img_url_1`–`img_url_5` (sisanya `NULL`), lalu commit ke DB. **Setelah commit** emit `listing:created` ke room `catalog`.

Errors: `401 UNAUTHORIZED`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, `422 VALIDATION_ERROR`, `503 SERVICE_UNAVAILABLE` bila Cloudinary gagal.

#### `PUT /shoes/:id` — `200 OK` (Owner)

Header: `Authorization: Bearer <JWT>`. Body: **`multipart/form-data`**. Ini **replace seluruh field mutable**, bukan partial update: `brand`, `article`, `category`, `condition`, `size`, `color`, `description`, `price`, `retainedImageUrls`, dan opsional file baru `images`.

Contoh **edit harga, hapus foto kedua, dan tambahkan satu foto baru**:

```js
const formData = new FormData();
formData.append("brand", current.brand);
formData.append("article", current.article);
formData.append("category", current.category);
formData.append("condition", current.condition);
formData.append("size", String(current.size));
formData.append("color", current.color);
formData.append("description", current.description);
formData.append("price", "400000");
// Urutan yang dipertahankan: foto utama lama; foto kedua lama dihapus.
formData.append("retainedImageUrls", JSON.stringify([current.imgUrl1]));
formData.append("images", newPhotoFile); // File baru ditempatkan sesudah imgUrl1.

await fetch(`${import.meta.env.VITE_API_URL}/shoes/${current.id}`, {
  method: "PUT",
  headers: { Authorization: `Bearer ${token}` },
  body: formData
});
```

**Aturan penting:**

1. `retainedImageUrls` tidak boleh berisi duplikat, URL asing, atau nilai yang bukan URL yang saat ini tersimpan pada shoe tersebut.
2. Jumlah foto akhir (`retainedImageUrls.length + images.length`) harus **1–5**. Ketika tidak menambah file, kirim `retainedImageUrls` dengan semua URL lama yang ingin dijaga.
3. Field terlarang `status`, `userId`, `seller`, `deletedAt`, `createdAt`, dan `imgUrl1`–`imgUrl5` langsung pada request ditolak `422`. Status hanya lewat endpoint status.
4. Jika upload/validasi gagal, DB tidak berubah; foto baru yang telanjur terupload dibersihkan best-effort berdasarkan public ID pada respons upload. Jangan menghapus foto lama sebelum DB commit berhasil.
5. Respons: `200` dengan `{ "success": true, "data": ShoeDetail }` yang menampilkan URL final dan posisi yang benar. Setelah commit emit `listing:updated` ke `catalog`, `shoes:<shoeId>`, dan room user peserta chat untuk invalidasi/refetch data.

Errors: `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 SHOE_NOT_FOUND`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, `422 VALIDATION_ERROR`, `503 SERVICE_UNAVAILABLE`.

#### `PATCH /shoes/:id/status` — `200 OK` (Owner)

Request Body:

```json
{ "status": "sold" }
```

Nilai valid: `sold` atau `available`. Status yang sama dikirim dua kali harus tetap sukses (idempotent). Response mengembalikan **seluruh ShoeDetail yang terbaru**. Sesudah commit, kirim `listing:status` ke room `catalog`, `shoes:<shoeId>`, dan notifikasi ringkas kepada semua peserta chat aktif pada listing tersebut. Jangan broadcast sebelum transaksi sukses.

Errors: `401`, `403`, `404`, `422`.

#### `DELETE /shoes/:id` — `204 No Content` (Owner)

Soft-delete dengan menetapkan `deleted_at`. Tidak menghapus chat, pesan, atau user. Emit `listing:deleted` ke `catalog`, room detail sepatu, dan user yang memiliki chat pada listing terkait. Jika sudah dihapus, endpoint boleh tetap mengembalikan `204` untuk owner yang sama (idempotent); jangan bocorkan data/listing kepada orang lain.

Errors: `401`, `403`, `404` untuk tidak ditemukan/tidak dapat diakses.

### 7.6 Chats dan messages

#### `POST /chats` — `201 Created` atau `200 OK` (Login)

Request:

```json
{ "shoeId": "20000000-0000-4000-8000-000000000001" }
```

- `201` jika baru dibuat; `200` jika sudah ada **untuk pasangan yang sama**.
- Backend derive `buyerId` dari JWT, derive `sellerId` dari `shoes.user_id`.
- Reject buyer == seller (`403 SELF_CHAT_NOT_ALLOWED`).
- Reject chat **baru** apabila sepatu sold (`409 SHOE_NOT_AVAILABLE`) atau dihapus (`404`). Jika sudah ada chat untuk `(shoeId, buyerId)`, server **mengembalikan chat lama terlebih dahulu**, termasuk ketika status sold/dihapus, agar histori tetap dapat diakses. Tidak ada duplikat saat request paralel.

Response: `{"success":true,"data":ChatSummary}`. Chat baru dapat memiliki `lastMessageAt: null` dan `lastMessage: null`.

#### `GET /chats` — `200 OK` (Login)

Query: `page=1&limit=12`. Response list `ChatSummary[]` dengan metadata page seperti katalog. Memuat seluruh chat di mana user menjadi **buyer ATAU seller**; dedup hasil, urutkan `lastMessageAt DESC NULLS LAST`, kemudian `createdAt DESC`, `id DESC`.

Tidak pernah mengembalikan chat milik user lain yang tidak melibatkannya.

#### `GET /chats/:id` — `200 OK` (Peserta)

Response: `{"success":true,"data":ChatDetail}`. Jika user bukan buyer/seller, `404 CHAT_NOT_FOUND` untuk mencegah enumerasi.

#### `GET /chats/:id/messages` — `200 OK` (Peserta)

Contoh:

```http
GET /chats/40000000-0000-4000-8000-000000000001/messages?limit=30
GET /chats/40000000-0000-4000-8000-000000000001/messages?before=<oldestMessageId>&limit=30
GET /chats/40000000-0000-4000-8000-000000000001/messages?after=<lastReceivedMessageId>&limit=100
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "50000000-0000-4000-8000-000000000001",
      "chatId": "40000000-0000-4000-8000-000000000001",
      "senderId": "10000000-0000-4000-8000-000000000001",
      "clientMessageId": "60000000-0000-4000-8000-000000000001",
      "text": "Halo, boleh nego jadi Rp400.000?",
      "readAt": null,
      "createdAt": "2026-10-13T09:15:00.000Z"
    }
  ],
  "meta": { "limit": 30, "hasMore": false, "nextCursor": null }
}
```

Aturan: tanpa cursor ambil **30 terbaru**, tetapi return dalam urutan kronologis. Dengan `before`, ambil pesan yang **lebih tua** daripada pesan penanda; `nextCursor` = ID pesan paling tua dari batch jika `hasMore=true`. Dengan `after`, ambil pesan lebih baru daripada penanda untuk sinkronisasi setelah reconnect; `nextCursor` = pesan paling baru jika `hasMore=true`. Urutan stabil didasarkan pada `(createdAt, id)`. Jika cursor tidak berasal dari chat tersebut → `422 INVALID_CURSOR`.

#### `PATCH /chats/:id/read` — `200 OK` (Peserta)

Request (opsional):

```json
{ "lastReadMessageId": "50000000-0000-4000-8000-000000000001" }
```

Jika field tidak dikirim, server menandai seluruh pesan masuk yang **sudah tersimpan saat request diproses**. Jika field dikirim, tandai hanya pesan masuk sampai pesan tersebut (inklusif, urut `(createdAt,id)`). Hanya pesan **lawan bicara** yang diubah `readAt`; jangan menandai pesan yang belum ada atau di chat lain. Emit `chat:read:updated` dan refresh unread server-side.

Response:

```json
{
  "success": true,
  "data": {
    "chatId": "40000000-0000-4000-8000-000000000001",
    "readCount": 1,
    "unreadCount": 0
  }
}
```


### 7.7 AI search

#### `POST /ai/search` — `200 OK` (Publik)

Request:

```json
{
  "query": "sepatu lari di bawah 500 ribu, jangan warna norak",
  "filterOverrides": { "excludeColors": [] },
  "limit": 12
}
```

- `query` wajib string 3–300 karakter. `limit` default 12, maksimal 20.
- `filterOverrides` opsional; hanya properti dari filter AI yang sah boleh dioverride, misalnya `excludeColors`, `preferColors`, `category`, `maxPrice`, `minPrice`, `size`. **Kehadiran** properti override menggantikan interpretasi LLM untuk properti itu. Contoh: user menghapus chip "hindari neon" dengan mengirim `excludeColors: []`; jangan memakai `[]` sebagai alasan untuk memakai nilai lama.
- Backend mengekstrak filter dan memvalidasi enum/tipe sebelum menyusun query parameterized. AI tidak boleh langsung membuat SQL.
- Hanya sepatu `status=available` dan `deleted_at IS NULL` yang dikembalikan.

Response (`shoe` memakai **tepat** bentuk `ShoeSummary` §6.4):

```json
{
  "success": true,
  "data": {
    "mode": "ai",
    "query": "sepatu lari di bawah 500 ribu, jangan warna norak",
    "interpretedFilters": {
      "category": "running",
      "maxPrice": 500000,
      "excludeColors": ["neon", "red", "yellow"],
      "preferColors": ["black", "gray", "white"]
    },
    "results": [
      {
        "shoe": {
          "id": "20000000-0000-4000-8000-000000000009",
          "seller": { "id": "10000000-0000-4000-8000-000000000002", "name": "Dimas" },
          "imgUrl1": "https://res.cloudinary.com/demo/image/upload/v1/shoes/contend.jpg",
          "brand": "Asics",
          "article": "Gel Contend 8",
          "category": "running",
          "condition": "good",
          "size": 42,
          "color": "black",
          "price": 380000,
          "currency": "IDR",
          "status": "available",
          "createdAt": "2026-10-13T09:00:00.000Z",
          "updatedAt": "2026-10-13T09:00:00.000Z"
        },
        "reason": "Kategori running, warna hitam, dan harga sesuai batas yang Anda minta."
      }
    ],
    "notice": null,
    "meta": { "totalItems": 1, "limit": 12 }
  }
}
```

`mode` hanya `ai` atau `fallback`. Bila gagal/timeout, API tetap mengembalikan **200** dengan `mode: "fallback"`, `interpretedFilters: null`, `reason: null` untuk setiap hasil, dan `notice` informatif; pencarian teks biasa dijalankan pada `brand`, `article`, `description` untuk kata yang relevan. Kondisi fallback bukan `500` selama hasil fallback tersedia. Jika tidak ada sepatu yang cocok, `results: []` dan `totalItems: 0` (bukan error).

**Tidak ada endpoint atau halaman saran harga AI.** Penentuan harga sepenuhnya dilakukan seller lewat field `price` dan negosiasi chat.

### 7.8 Health check

#### `GET /health` — `200 OK` (Publik)

```json
{ "success": true, "data": { "status": "ok", "service": "soleswap-api" } }
```

Jangan bocorkan URL DB, credential, konfigurasi LLM, uptime infrastruktur sensitif, atau stack trace.

---

## 8. Socket.io event contract

### 8.1 Koneksi, autentikasi, dan room

**Penting: revisi dari PRD sumber.** PRD awal meminta JWT pada semua handshake Socket.io. Karena homepage/detail kini **publik** dan perubahan status `sold` harus terlihat realtime untuk **semua pengunjung**, koneksi tanpa token **boleh** dibuat hanya untuk langganan publik. Event privat wajib menggunakan socket terautentikasi.

```js
// Client setelah login
const socket = io(import.meta.env.VITE_SOCKET_URL, {
  autoConnect: false,
  auth: { token: accessToken },
  reconnection: true
});
socket.connect();

// Client guest untuk perubahan status katalog/detail saja
const publicSocket = io(import.meta.env.VITE_SOCKET_URL, {
  autoConnect: false,
  reconnection: true
});
publicSocket.connect();
```

- Socket **dengan token yang invalid/expired** ditolak dengan `connect_error` berisi `UNAUTHORIZED` (jangan diperlakukan sebagai Guest secara diam-diam).
- Socket Guest yang **tidak mengirim token** hanya boleh `catalog:join`, `catalog:leave`, `listing:join`, `listing:leave`.
- Setelah login/logout/token berubah, **disconnect socket lama** dan buat ulang koneksi sesuai identitas baru. Jangan memakai koneksi Guest untuk mengirim pesan/chat privat.
- JWT dibaca dari `handshake.auth.token`, **bukan query string**. Origin wajib disaring dengan daftar CORS yang diizinkan.
- Room private hanya di-join oleh server setelah validasi peserta berdasarkan DB. `user:<userId>` **tidak memiliki event join dari client**.

| Room | Siapa yang boleh join | Dipakai untuk |
|---|---|---|
| `catalog` | Guest/login, melalui `catalog:join` | Listing baru, sold/available, delete tanpa refresh |
| `shoes:<shoeId>` | Guest/login, jika listing publik masih ada | Status perubahan pada detail sepatu |
| `chat:<chatId>` | Hanya buyer dan seller yang terverifikasi | Pesan, typing, receipt/read |
| `user:<userId>` | Join otomatis oleh server saat auth sukses | Inbox, notif pesan, unread, status listing relevan |

`catalog` dan `shoes:<id>` bersifat **read-only untuk tamu**. Validasi semua input room dan batasi subscription berlebihan.

### 8.2 Format Socket ACK yang wajib

Untuk setiap event mutasi atau join yang dikirim client, gunakan Socket.io acknowledgement callback:

**Sukses**:

```json
{ "success": true, "data": { "joined": true, "chatId": "40000000-0000-4000-8000-000000000001" } }
```

**Gagal**:

```json
{
  "success": false,
  "error": { "code": "FORBIDDEN", "message": "Bukan peserta chat ini" }
}
```

ACK harus dipanggil **tepat satu kali** oleh handler server. Jangan bergantung pada event broadcast untuk memastikan suksesnya perintah. `message:send` di client diberi timeout ACK **5 detik**; timeout berarti status **belum pasti** sehingga retry wajib memakai `clientMessageId` yang sama untuk mencegah duplikasi.

### 8.3 Matriks event dan payload

| Event | Arah | Payload client / data broadcast | Auth | Efek |
|---|---|---|---|---|
| `catalog:join` | C→S | `{}` | Publik | Join `catalog` dan ACK |
| `catalog:leave` | C→S | `{}` | Publik | Keluar `catalog` |
| `listing:join` | C→S | `{ "shoeId": "uuid" }` | Publik | Join `shoes:<id>` jika listing ada |
| `listing:leave` | C→S | `{ "shoeId": "uuid" }` | Publik | Keluar room |
| `chat:join` | C→S | `{ "chatId": "uuid" }` | Peserta | Join setelah cek buyer/seller |
| `chat:leave` | C→S | `{ "chatId": "uuid" }` | Peserta | Keluar room chat |
| `message:send` | C→S | `{ "chatId", "clientMessageId", "text" }` | Peserta | Simpan sekali ke DB, ACK pesan, broadcast |
| `message:new` | S→C | `Message` (§6.4) | Room chat | Render pesan realtime |
| `typing:start` | C→S | `{ "chatId": "uuid" }` | Peserta | Kirim typing ke peserta lain |
| `typing:stop` | C→S | `{ "chatId": "uuid" }` | Peserta | Hentikan indikator typing |
| `typing:update` | S→C | `{ "chatId", "userId", "isTyping" }` | Room chat | Indikator mengetik |
| `chat:read` | C→S | `{ "chatId", "lastReadMessageId"? }` | Peserta | Sama dengan PATCH `/chats/:id/read` |
| `chat:read:updated` | S→C | `{ "chatId", "readerId", "lastReadMessageId"? }` | Room chat | Sinkronkan indikator sudah dibaca |
| `chat:created` | S→C | `ChatSummary` | Room user seller dan buyer | Inbox chat baru muncul |
| `notification:new` | S→C | `{ "chatId", "message": Message, "unreadCount" }` | Room user penerima | Inbox update saat pesan datang |
| `unread:update` | S→C | `{ "totalUnread": 2, "chatId": "uuid", "unreadCount": 1 }` | Room user penerima | Badge unread menjadi nilai server |
| `listing:created` | S→C | `{ "shoe": ShoeSummary }` | Room catalog | Sisipkan card/catat cache stale |
| `listing:updated` | S→C | `{ "shoeId", "updatedAt" }` | Catalog, shoes room, user peserta chat | Refetch/invalidate listing/detail untuk pembaruan harga, deskripsi, dan gambar |
| `listing:status` | S→C | `{ "shoeId", "status", "updatedAt" }` | Catalog, shoe room, user peserta chat | Perbarui status tersedia/terjual |
| `listing:deleted` | S→C | `{ "shoeId", "deletedAt" }` | Catalog, shoe room, user peserta chat | Hapus card; chat histori menjadi read-only |
| `presence:update` | S→C | `{ "userId", "online" }` | Pengguna relevan | **Should**: online/offline |

`C→S` = client ke server; `S→C` = server ke client. Semua ID contoh di tabel bertipe **UUID string**. Pada payload event pribadi, server tidak boleh mempercayai `userId`/`senderId` yang dikirim client; identitas diperoleh dari token valid.

### 8.4 Alur `message:send` yang deterministik

Client mengirim:

```js
socket.timeout(5000).emit(
  "message:send",
  {
    chatId: "40000000-0000-4000-8000-000000000001",
    clientMessageId: "60000000-0000-4000-8000-000000000001",
    text: "Bisa COD di Jakarta Selatan?"
  },
  (err, ack) => {
    if (err) {
      // Status uncertain. Retry dengan clientMessageId sama.
      return;
    }
    if (!ack.success) {
      // Render error: ack.error.code dan ack.error.message.
      return;
    }
    // Ganti pesan optimistic dengan ack.data.message.
  }
);
```

Backend **wajib** mengikuti urutan:

1. Cek koneksi authenticated, `chatId` valid dan user anggota chat.
2. Cek listing belum soft-deleted; chat lama pada `sold` tetap boleh mengirim pesan koordinasi.
3. Validasi teks (trim, panjang **1–2000** karakter setelah trim); tolak string kosong, object, array, atau pesan HTML tidak perlu diperlakukan sebagai HTML.
4. Jalankan operasi DB yang **idempotent** berdasarkan `(senderId, clientMessageId)`. Jika ID sama sudah tersimpan dengan `chatId` dan `text` yang sama, kembalikan pesan lama; jika ID sama digunakan untuk payload berbeda, ACK `409 IDEMPOTENCY_CONFLICT`.
5. Persist pesan serta update `chats.lastMessageAt` secara atomic di DB.
6. Setelah commit, ACK dengan `{ "success": true, "data": { "message": Message } }`, emit `message:new` ke room chat dan `notification:new` + `unread:update` ke room user lawan bicara.
7. Untuk pesan hasil retry yang sudah pernah diproses, **jangan broadcast ulang**; ACK objek yang sudah tersimpan.

**Penting:** Pengirim yang menerima ACK dan `message:new` dapat mendapat data sama dua kali; client wajib **dedup berdasarkan `message.id`/`clientMessageId`**.

Jika listing statusnya `sold`, pesan lama/baru tetap terlihat. Jika listing dihapus, `message:send` mengembalikan ACK error `SHOE_DELETED` dan UI mengunci composer.

### 8.5 Read receipt, unread, typing, presence

- `readAt` per message menandai kapan **pesan masuk** dibaca; hanya penerima, tidak pernah pengirim, yang dapat mengubahnya. Bulk update terhadap pesan yang belum dibaca memakai satu timestamp.
- `GET /chats` selalu menghitung `unreadCount` sesuai database, bukan berdasarkan jumlah event yang diperkirakan client.
- `unread:update` membawa **nilai final** dari server. Client **mengganti**, bukan menambah secara manual; ini mengurangi badge ganda setelah reconnect.
- `notification:new` dikirim kepada user penerima **walaupun chat belum terbuka**. Bila chat sedang terbuka, frontend boleh segera memanggil `chat:read` setelah pesan terlihat; jangan mengandalkan status tab aktif dari server.
- `typing:start`/`typing:stop` adalah **Must**; frontend debounce/throttle agar tidak mengirim event untuk tiap ketikan. Server broadcast hanya ke chat lain, tidak persist ke DB. Indikator berhenti otomatis di client jika tidak ada update selama kira-kira **3 detik** atau socket disconnect.
- `presence:update` adalah **Should**; jika diimplementasikan, hitung online dari jumlah koneksi aktif per user (bukan hanya koneksi terakhir), jangan ungkap status ke publik umum.

### 8.6 Reconnect dan lost events

1. Socket.io reconnect otomatis; client ulangi join `catalog`, `shoes:<id>`, dan semua `chat:<id>` yang sedang dibutuhkan.
2. Koneksi socket tidak dianggap sebagai source of truth. Setelah reconnect, panggil `GET /chats` untuk inbox/unread dan `GET /chats/:id/messages?after=<lastPersistedMessageId>` untuk pesan chat yang terlewat.
3. Jika tidak punya pesan terakhir, gunakan request histori standar tanpa `after`.
4. Jika JWT kedaluwarsa, tampilkan sesi habis dan arahkan ulang ke login; jangan reconnect tanpa auth untuk event private.
5. Untuk listing, refetch `GET /shoes` atau `GET /shoes/:id` saat reconnect agar status tidak stale.
6. Jangan mengasumsikan urutan event dari room berbeda. Gunakan `updatedAt` dan respons REST untuk rekonsiliasi.

---

## 9. AI search

### 9.1 Scope AI yang disetujui

AI dalam proyek ini memiliki **tepat satu fungsi: memahami pencarian bahasa natural** seperti:

> "sepatu lari di bawah 500 ribu, jangan warna norak"

AI **bukan** penilai harga sepatu, tidak menentukan harga listing, tidak menyimpulkan kondisi sepatu berdasarkan gambar, dan tidak mengirim pesan ke seller.

### 9.2 Pipeline backend

```mermaid
flowchart TD
  A[User memasukkan query] --> B[POST /ai/search]
  B --> C{LLM berhasil dan JSON valid?}
  C -->|Ya| D[Validasi & normalisasi filter JSON]
  D --> E[Override chip/filter UI jika ada]
  E --> F[Parameterized query PostgreSQL]
  F --> G[Result available + alasan singkat]
  C -->|Timeout/gagal| H[Fallback plain-text search]
  H --> I[mode fallback + notice]
  G --> J[Render listing + chip interpretasi]
  I --> J
```

**Filter hasil AI** yang diizinkan (semuanya opsional dan tervalidasi):

```json
{
  "category": "running",
  "minPrice": null,
  "maxPrice": 500000,
  "size": null,
  "excludeColors": ["neon", "red", "yellow"],
  "preferColors": ["black", "gray", "white"]
}
```

Aturan:

- LLM diminta memberi JSON terstruktur dan **tidak boleh menghasilkan SQL**.
- Server membuang filter yang tidak didukung, menormalisasi istilah bahasa Indonesia ke enum backend, dan membatasi nilai numerik sesuai rentang.
- `excludeColors` adalah filter keras: warna tersebut dikecualikan. `preferColors` adalah **ranking preferensi**, bukan larangan untuk warna lain. Jika keduanya konflik, exclusion menang.
- Frasa subjektif seperti "norak" adalah interpretasi AI, **bukan fakta objektif**. UI menampilkan chips yang dapat dihapus user dan mengirim `filterOverrides` untuk requery.
- Alasan singkat hasil harus berdasarkan **atribut listing yang benar-benar ada**, bukan mengarang kualitas/kondisi barang. Boleh `null` jika tidak cukup alasan aman.
- Hasil dibatasi `limit` (maks. 20); UI dapat menawarkan kembali ke katalog biasa untuk paging penuh.
- Minimum 3 skenario demo disiapkan dan disimpan dalam checklist QA.

### 9.3 Failure, keamanan, dan biaya

- **Timeout total LLM 8 detik** sebagai default teknis. Jika JSON invalid, validasi/ulang maksimum satu kali **hanya selama masih dalam batas waktu total**; kemudian fallback.
- Fallback `q` berbasis teks dari query user terhadap brand, article, description tanpa penambahan filter spekulatif dari LLM gagal.
- Public AI search memakai rate limit **berbasis IP** (contoh awal 10 request/menit/IP); jika login juga dapat limit per user. Angka final sesuai budget provider.
- Jangan menyimpan API key di `VITE_*`. Jangan memasukkan data pribadi chat ke prompt AI.
- Provider LLM dan model diputuskan bersama saat setup; contract API tidak bergantung pada vendor tertentu.
- Jangan cache respons yang mengembalikan listing yang sudah `sold` tanpa memfilter ulang terhadap database. Cache interpretasi query lebih aman daripada cache hasil listing.

---

## 10. Validasi, keamanan, dan edge cases

### 10.1 Matriks otorisasi minimum

| Tindakan | Guest | User login bukan owner | Owner listing | Peserta chat |
|---|---:|---:|---:|---:|
| Katalog/detail/AI search | ✅ | ✅ | ✅ | ✅ |
| Create listing | ❌ | ✅ | ✅ | ✅ |
| Edit/delete/status listing | ❌ | ❌ | ✅ | ❌ kecuali juga owner |
| Buat chat ke listing tersedia milik orang lain | ❌ | ✅ | ❌ | ✅ jika sudah ada |
| Baca chat/message milik orang lain | ❌ | ❌ | ❌ kecuali peserta | ✅ |
| Kirim pesan pada chat aktif | ❌ | ❌ | ❌ kecuali peserta | ✅ |
| Subscribe status publik `catalog` | ✅ | ✅ | ✅ | ✅ |

- **Otorisasi selalu di server** pada REST dan setiap Socket event. Menyembunyikan tombol React bukan security control.
- Jangan menerima `sellerId`, `buyerId`, `senderId`, `userId` dari body untuk menentukan hak akses; selalu derive dari JWT + relasi DB.
- Cegah IDOR: penggantian UUID pada URL chat bukan alasan mengembalikan datanya; untuk non-peserta gunakan `404`.
- Password disimpan hanya sebagai bcrypt hash; jangan pernah masuk serialization `UserPublic`.
- Chat text di React dirender sebagai teks biasa, **bukan** `dangerouslySetInnerHTML`.
- Simpan semua credential dan private key di env server; jangan commit `.env`.
- Rate-limit login, register, upload, AI, dan pengiriman pesan; batasi body JSON dan jumlah koneksi/socket per IP sesuai kemampuan platform.
- Gunakan HTTPS/WSS di production. CORS membatasi origins, tetapi **CORS bukan pengganti JWT dan ownership validation**.

### 10.2 Matriks edge cases / expected behavior

| Kasus | Perilaku wajib |
|---|---|
| Guest klik chat | Redirect login/register dengan pending intent; setelah auth auto get-or-create chat |
| Login berhasil tetapi sepatu sudah sold | POST chat baru → `409` (jika belum pernah chat), tampilkan info dan detail sold |
| Buyer klik Chat berkali-kali | Hanya 1 chat per `(shoeId, buyerId)`; request berikutnya `200` chat lama |
| Dua request create chat paralel | Unique DB constraint; satu dibuat, sisanya dapat chat yang sama |
| User coba chat dengan listing sendiri | `403 SELF_CHAT_NOT_ALLOWED`; UI tampilkan Edit |
| User ubah `shoeId`/`chatId` di request secara manual | Server cek owner/participant, tolak yang tidak sah |
| User tandai sold saat buyer membuka detail | `listing:status` membuat UI disable chat baru tanpa reload |
| Chat lama pada sold | Bisa dibaca dan dipakai koordinasi; banner "Sudah terjual" |
| Sepatu soft deleted | Tidak ada di katalog/detail publik; histori chat tetap ada dan **read-only** |
| Cloudinary berhasil tetapi DB gagal | Listing tidak dibuat, foto Cloudinary baru dibersihkan best-effort |
| Edit mengganti urutan/foto | `retainedImageUrls` terotorisasi + `images` baru menghasilkan 1–5 foto final sesuai urutan |
| Gagal Cloudinary | `503`; DB listing tetap utuh, cleanup file terlanjur upload best-effort |
| Pesan terkirim tapi ACK timeout | Client retry dengan `clientMessageId` sama; tidak boleh duplikat pesan |
| Dua browser kirim pesan bersamaan | Kedua pesan disimpan, urutan tampil berdasarkan `(createdAt, id)` |
| Recipient membuka inbox di perangkat lain | Unread berasal dari DB; `unread:update` menyinkronkan tab terkait |
| Socket disconnect | UI tampil "Menghubungkan ulang" dan refetch data yang tertinggal |
| Token expired saat socket masih hidup | Server harus membatasi aksi privat dan memutus koneksi paling lambat saat expiry; client kembali login |
| AI timeout / output JSON rusak | Fallback normal dengan `mode=fallback`, tidak crash halaman |
| Filter AI menghasilkan 0 listing | Sukses `results=[]`, beri empty state; bukan `404` |
| User menghapus chip interpretasi | `filterOverrides` berlaku dan hasil diquery ulang |
| Harga berubah di tengah negosiasi | Tampilan harga terkini update dari REST; riwayat pesan tidak diedit |
| User mencoba mengubah status via `PUT /shoes/:id` | Tolak field yang tidak diizinkan `422`; harus lewat endpoint status |
| Link deep-link `/chats/:id` dibuka tanpa login | Login dahulu; setelah auth tetap wajib cek peserta |

### 10.3 Transaksi database dan konsistensi

- Create/update listing serta penyimpanan URL gambar di PostgreSQL dilakukan dalam **transaksi DB**, setelah upload ke Cloudinary. Transaksi DB tidak dapat me-rollback Cloudinary; lakukan cleanup best-effort pada kegagalan.
- `message:send` menyimpan pesan serta `lastMessageAt` **dalam transaksi**; event baru dikirim **setelah commit**.
- `PATCH /shoes/:id/status` menyimpan status sebelum broadcast; bila broadcast gagal, REST GET tetap menampilkan state sahih dan reconnect akan merekonsiliasi.
- Unique constraint `chats(shoe_id,buyer_id)` dan `messages(sender_id,client_message_id)` dipastikan benar-benar terpasang lewat migration; tidak cukup hanya validasi kode aplikasi.
- Untuk banyak proses Socket.io, room dan event perlu adapter distribusi (mis. Redis); MVP boleh satu instance Node selama provider WebSocket mendukung koneksi stabil. Jangan menjalankan beberapa replika tanpa mekanisme event lintas instance.

---

## 11. Konfigurasi dan deployment

### 11.1 Environment variables

**`client/.env.example`**:

```dotenv
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

**`server/.env.example`**:

```dotenv
NODE_ENV=development
PORT=3000
CLIENT_ORIGINS=http://localhost:5173
DATABASE_URL=postgresql://postgres:password@localhost:5432/soleswap
JWT_SECRET=CHANGE_ME_MINIMUM_32_RANDOM_CHARACTERS
JWT_EXPIRES_IN=24h
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
LLM_PROVIDER=your_provider
LLM_API_KEY=your_private_llm_key
LLM_MODEL=your_selected_model
AI_TIMEOUT_MS=8000
```

- Contoh `.env.example` hanya placeholder; `.env` sebenarnya **tidak boleh** masuk Git.
- `VITE_*` hanya berisi URL publik/tidak rahasia. Cloudinary API secret dan LLM API key hanya di backend.
- Gunakan satu nama `CLIENT_ORIGINS` sebagai daftar origins dipisah koma jika ada beberapa env; parser harus trim masing-masing dan menghindari wildcard pada prod.
- Simpan secret asli di dashboard hosting/secret manager; ganti secret jika tidak sengaja ter-commit.

### 11.2 Setup lokal — rancangan standar

Pilih satu package manager dan commit lockfile. Contoh memakai npm dengan folder `client/` dan `server/`:

```bash
# Dari root repository
npm --prefix server install
npm --prefix client install
cp server/.env.example server/.env
cp client/.env.example client/.env

# Jalankan Sequelize migration/seed dari server (setelah config Sequelize dibuat)
cd server
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
cd ..

# Jalankan pada dua terminal yang berbeda
npm --prefix server run dev
npm --prefix client run dev
```

**Catatan:** perintah di atas adalah target setup yang harus didukung repo, **bukan klaim bahwa kode sudah tersedia**. Sequelize CLI harus dipasang/configured oleh tim backend. Jika seed bukan bagian migrasi awal, jalankan hanya migration dan sediakan seed demo pada skrip terpisah. Paket masing-masing sebaiknya menyediakan `npm run dev`, `npm test`, `npm run lint`, `npm run build`.

### 11.3 Deployment target

| Komponen | Syarat |
|---|---|
| Frontend | Vercel/Netlify/setara, HTTPS, SPA route rewrite ke `index.html` |
| Backend | Node long-running yang mendukung Socket.io/WebSocket persisten; **bukan endpoint serverless yang mematikan koneksi** |
| Database | PostgreSQL terkelola; migration dijalankan sebelum smoke test |
| Images | Cloudinary; credentials di server |
| AI | Provider dan API key di server; fallback tetap hidup saat provider gagal |
| CORS/socket | Origin frontend produksi dimasukkan allowlist; WSS berfungsi |

### 11.4 Checklist smoke test production

- [ ] Akses `/` dan `/shoes/:id` langsung lewat URL di browser Guest (tidak redirect login).
- [ ] Refresh pada `/my-shoes`, `/chats/:id`, dan halaman edit tetap dirutekan SPA dengan benar.
- [ ] Register/login dan pemulihan `GET /auth/me` berfungsi.
- [ ] `POST /shoes` multipart dengan foto dan `PUT /shoes/:id` multipart (retained + foto baru), mark sold, dan soft delete berfungsi.
- [ ] Chat buyer/seller realtime pada **dua browser yang berbeda**, dengan riwayat persisten.
- [ ] Sold status realtime terlihat pada homepage Guest dan detail Guest.
- [ ] AI search sukses pada 3 contoh query; fallback diuji dengan provider sengaja dimatikan di staging.
- [ ] CORS production benar, tidak ada secret di bundle frontend, tidak ada error sensitif di response.
- [ ] Semua migration/seed aman; data demo disediakan tanpa kredensial hardcoded di Git.

---

## 12. Pembagian kerja, kolaborasi, dan change control

### 12.1 Urutan implementasi yang disarankan

| Fase | Backend / data | Frontend | Integrasi / QA |
|---|---|---|---|
| **0. Contract freeze** | Fix skema DB, enum, validasi, OpenAPI, event payload | Fix routes, type model, mock response | Sepakati skema multipart dan contoh JSON |
| **1. Foundation** | Express, DB migrations, auth, seeding, errors | Router, AuthContext, public page, guards | Register/login + redirect deep-link |
| **2. Marketplace** | Multipart create/edit + Cloudinary, catalog, detail, CRUD, status | ListingCard, detail, My Shoes, form, preview | Auth/ownership/upload/sold test |
| **3. Realtime** | Chat endpoints, unique constraints, socket JWT, events, unread | Inbox, ChatWindow, optimistic UI, reconnect | Dua-browser message/status/unread test |
| **4. AI & polish** | AI search + fallback/rate limit | AISearchBar, chips, reason, fallback UI | 3+ query demo, empty/error states |
| **5. Release** | Prod hosting, DB migration, logs | Prod SPA, env, responsive UI | Smoke test publik H-1, regression |

**Prioritas:** chat realtime + CRUD marketplace tidak boleh tertunda karena penambahan fitur Nice-to-have.

### 12.2 Ownership tugas (isi dengan nama anggota)

| Modul | PIC Backend | PIC Frontend | Reviewer/QA | Status |
|---|---|---|---|---|
| Auth + redirect | TBD | TBD | TBD | Todo |
| Catalog + detail | TBD | TBD | TBD | Todo |
| Cloudinary multipart + CRUD | TBD | TBD | TBD | Todo |
| Chat REST + Socket.io | TBD | TBD | TBD | Todo |
| Unread/typing + sold broadcast | TBD | TBD | TBD | Todo |
| AI search + fallback | TBD | TBD | TBD | Todo |
| DB schema + migrations + seed | TBD | — | TBD | Todo |
| Deployment + QA/E2E | TBD | TBD | TBD | Todo |

### 12.3 Aturan kolaborasi wajib

1. **Contract-first:** frontend boleh memakai mock dari contoh JSON sebelum backend selesai. Backend wajib mengikuti skema yang sama.
2. **Nama field tidak boleh bergeser:** `shoeId` bukan `ShoesId`, `buyerId` bukan `BuyerId`; gunakan camelCase di wire contract.
3. **Branch per fitur:** contoh `feat/auth-backend`, `feat/chat-ui`, `fix/socket-unread`.
4. **PR kecil + reviewer:** sertakan screenshot/rekaman singkat bila mengubah UI, contoh request/response bila mengubah API.
5. **Breaking change wajib disetujui FE+BE:** update README, OpenAPI/Postman, TS types, mock, tests, dan change log dalam PR yang sama.
6. **Migrasi DB dijalankan berurutan**, tidak mengedit migration yang sudah diterapkan tim; tulis migration baru.
7. **Setiap bug integrasi menyebut request/event, payload, status/error, dan langkah reproduksi**, bukan hanya "API error".
8. **Tidak ada rahasia di repo:** `.env`, JWT secret, token, dan provider key tidak boleh di-commit.

### 12.4 Pull Request Definition of Done

Sebuah fitur berstatus Done bila:

- [ ] Implementasi sesuai kontrak yang sudah di-freeze dan tidak mengubah field secara diam-diam.
- [ ] Validasi dan authorization server-side lulus (termasuk negative test).
- [ ] Loading, empty, failure, dan success state tercakup di UI bila relevan.
- [ ] Unit/integration test relevan dan linter/build lulus.
- [ ] Contoh API/event dan dokumentasi diupdate bila ada perubahan.
- [ ] Telah ditinjau minimal satu anggota tim lain dan dicoba pada environment integrasi.

### 12.5 Change log

| Versi | Tanggal | Perubahan | Disetujui oleh |
|---|---|---|---|
| PRD rev2 | Sebelum 13-10-2026 | Requirement awal: auth, CRUD, chat realtime, AI search, AI saran harga | PRD sumber |
| README v1.1 | 13-10-2026 | Katalog/detail publik; chat login redirect; soft delete; REST/Socket contract; **fitur AI saran harga dihapus** | Product Owner (keputusan produk) |
| README v1.2 | 13-10-2026 | Hapus prefix `/api/v1`; upload Cloudinary digabung ke POST/PUT sepatu dengan multipart; skema 5 URL foto, route, model data, dan contoh integrasi diseragamkan | Draft revisi — menunggu sign-off tim FE+BE |

Format perubahan selanjutnya: **versi, tanggal, alasan, dampak API/DB/socket/FE, reviewer backend, reviewer frontend**. Untuk perubahan breaking, naikkan versi contract minor/major sesuai kesepakatan tim.

---

## 13. Acceptance criteria dan test scenarios

### 13.1 Acceptance test (bisa dijadikan manual E2E)

| ID | Skenario | Langkah ringkas | Hasil yang diharapkan |
|---|---|---|---|
| AUTH-01 | Registrasi berhasil | Submit nama, email baru, password valid | `201`, user+JWT, login state aktif |
| AUTH-02 | Duplikasi email | Register dengan email sama beda kapital | `409 EMAIL_ALREADY_EXISTS` |
| AUTH-03 | Login gagal | Masukkan password salah | `401 INVALID_CREDENTIALS`, tanpa bocor info |
| FLOW-01 | Guest browsing | Buka `/`, klik listing | Katalog/detail tampil tanpa login |
| FLOW-02 | Guest klik Chat Seller | Klik chat, register/login | Otomatis membuka chat untuk listing yang sama |
| FLOW-03 | Link privat | Akses `/chats/:id` sebagai Guest | Login; sesudahnya tetap cek membership |
| SHOE-01 | Create | POST /shoes multipart dengan 1–5 file gambar | `201`, card muncul di katalog |
| SHOE-02 | Owner edit | Owner PUT multipart: ubah harga, retain 1 foto lama, tambah file baru | `200`, detail menampilkan data baru |
| SHOE-03 | Unauthorized edit | Akun B PUT shoe akun A | `403/404`, DB tidak berubah |
| SHOE-04 | Mark sold realtime | Seller sold; Guest di tab lain mengamati | Status sold tanpa refresh; chat baru dicegah |
| SHOE-05 | Soft delete | Owner hapus listing dengan chat lama | Hilang dari katalog; chat lama terbaca read-only |
| SHOE-06 | Validasi foto | POST /shoes dengan 6 gambar / file 6 MB | `422` (jumlah >5) / `413` (file >5 MB) |
| CHAT-01 | Unik chat | Buyer POST chat dua kali | Hanya 1 record; respons `201` lalu `200` |
| CHAT-02 | Tidak bisa chat sendiri | Seller POST chat untuk shoe sendiri | `403 SELF_CHAT_NOT_ALLOWED` |
| CHAT-03 | Chat realtime | Buyer/seller di browser terpisah kirim pesan | Muncul tanpa refresh; target <1 detik pada jaringan stabil |
| CHAT-04 | Histori persisten | Kirim pesan lalu reload di kedua browser | Pesan tersimpan dan urut konsisten |
| CHAT-05 | No duplicate retry | Resend dengan `clientMessageId` sama | Cuma satu message DB dan satu tampilan |
| CHAT-06 | Anti-IDOR | User C coba `GET messages` chat A-B / socket join | `404`/ACK `FORBIDDEN`; tidak dapat pesan |
| CHAT-07 | Unread | Buyer kirim pesan saat seller di inbox | Badge bertambah dari server, hilang saat dibaca |
| CHAT-08 | Typing | Buyer mengetik, seller membuka chat | Seller melihat indikator typing lalu berhenti |
| CHAT-09 | Reconnect | Matikan koneksi sesaat, kirim pesan, sambung | Data tertinggal diambil via REST tanpa duplikat |
| CHAT-10 | Deal dari chat | Seller klik `Tandai Terjual` dalam ruang chat | PATCH status berhasil; semua tab menerima sold realtime |
| AI-01 | Cari natural language | "sepatu lari di bawah 500 ribu" | Filter/ranking masuk akal, hanya available |
| AI-02 | Preferensi warna | "sepatu hitam yang kalem" | Hasil relevan/interpretasi terlihat pada chip |
| AI-03 | Negasi warna | "jangan warna norak" | AI mengusulkan excludeColors, chip dapat dihapus |
| AI-04 | Provider gagal | Matikan credential/provider di staging | Response mode fallback dan search biasa berfungsi |
| SEC-01 | Anonymous socket | Guest join catalog; coba message:send | Status publik diterima; private event ditolak |
| SEC-02 | Token kedaluwarsa | Expire JWT lalu mutate / socket private | `401`/disconnect, kembali ke login |

### 13.2 Evaluasi demo sesuai target PRD

- [ ] Dua akun berbeda dan dua browser benar-benar berkomunikasi realtime dalam target <1 detik untuk kondisi demo normal.
- [ ] Seller bisa menandai sepatu `sold` dan Guest melihat perubahan realtime.
- [ ] AI search mendemonstrasikan setidaknya 3 query bahasa natural yang masuk akal.
- [ ] Register/login, CRUD sepatu, upload, inbox, typing, unread, dan fallback terbukti berjalan.
- [ ] Semua requirement **challenge resmi** dicek terhadap rubric dari pengajar. PRD sumber menyebut "Checklist challenge" tetapi tidak melampirkannya, sehingga kepatuhan terhadap rubric **belum bisa dinyatakan otomatis** hanya dari dokumen ini.

### 13.3 Jenis automated testing yang dianjurkan

- **Backend unit:** validators, normalized email, auth guards, AI filter parser, service chat get-or-create.
- **Backend integration:** REST auth + CRUD + owner checks + cursor, DB uniqueness, socket authentication/ACK.
- **Frontend component:** states ListingCard, Auth guard, Chat optimistic/retry, badge unread.
- **E2E:** Guest → register → chat; seller → listing → status sold, serta dua-browser chat.
- **Load smoke ringan:** 10–20 socket demo aktif bersamaan, bukan stress test produksi.

---

## 14. Checklist sign-off

**Disetujui Product Owner (13-10-2026):**

- [x] Guest bebas melihat homepage katalog dan detail.
- [x] Chat, post listing, My Shoes, dan inbox membutuhkan login.
- [x] Setelah login/register dari tombol Chat, user kembali ke chat sepatu yang tadi dipilih.
- [x] Satu akun dapat menjual dan membeli; tidak ada pembedaan role akun.
- [x] Seller dapat membuat, mengedit, mengubah sold/available, soft delete, dan menambah posting.
- [x] Chat per pasangan shoe-buyer unik; histori dipertahankan.
- [x] Sold tidak menerima chat baru; chat lama dapat digunakan koordinasi.
- [x] Cloudinary digunakan untuk menyimpan gambar, upload dilakukan langsung pada POST/PUT sepatu (tanpa endpoint upload terpisah).
- [x] Tidak ada payment/order/delivery integration; COD dan negosiasi via chat.
- [x] **Tidak ada fitur saran harga AI, hanya AI search natural language.**

**Perlu disetujui seluruh tim sebelum contract freeze:**

- [ ] Kunci enum serta limit `size`, `condition`, `category`, `color`, file, dan harga (termasuk mekanisme `retainedImageUrls`).
- [ ] Konfirmasi Sequelize sebagai ORM, konfigurasi Sequelize CLI, dan tulis migration pertama; sepakati apakah Cloudinary public ID disimpan untuk cleanup objek.
- [ ] Setujui wire JSON/response envelope, UUID, pagination/cursor, read receipt, error codes.
- [ ] Setujui event Socket.io, guest public socket dan ACL room, ACK, idempotency.
- [ ] Tentukan provider LLM, Cloudinary, PostgreSQL, host backend WebSocket, serta environment dev/prod.
- [ ] Tetapkan PIC per modul, milestone, akun demo, dan reviewer integrasi.
- [ ] Lampirkan rubric/checklist resmi Group Project Fase 2 bila ada.
- [ ] Ubah `Status` di atas menjadi `APPROVED` setelah semua anggota FE+BE menyetujui.

---

## 15. Lampiran: contoh integrasi dan tipe data

### 15.1 Contoh tipe TypeScript shared (opsional, direkomendasikan)

```ts
type UUID = string;
type ISODate = string;

type ShoeStatus = "available" | "sold";
type ShoeCategory = "running" | "casual" | "basketball" | "formal" | "sneakers" | "other";
type ShoeCondition = "like_new" | "good" | "fair";
type ShoeColor =
  | "black" | "white" | "gray" | "red" | "blue" | "green"
  | "yellow" | "brown" | "beige" | "purple" | "pink"
  | "orange" | "neon" | "multicolor" | "other";

type UserPublic = { id: UUID; name: string };
type UserSelf = UserPublic & { email: string; createdAt: ISODate };

type ShoeSummary = {
  id: UUID;
  seller: UserPublic;
  imgUrl1: string;
  brand: string;
  article: string;
  category: ShoeCategory;
  condition: ShoeCondition;
  size: number;
  color: ShoeColor;
  price: number;
  currency: "IDR";
  status: ShoeStatus;
  createdAt: ISODate;
  updatedAt: ISODate;
};

type ShoeDetail = ShoeSummary & {
  description: string;
  imgUrl2: string | null;
  imgUrl3: string | null;
  imgUrl4: string | null;
  imgUrl5: string | null;
};

type Message = {
  id: UUID;
  chatId: UUID;
  senderId: UUID;
  clientMessageId: UUID;
  text: string;
  readAt: ISODate | null;
  createdAt: ISODate;
};

type ChatSummary = {
  id: UUID;
  shoe: Pick<ShoeSummary, "id" | "brand" | "article" | "imgUrl1" | "status"> & {
    isDeleted: boolean;
  };
  buyer: UserPublic;
  seller: UserPublic;
  otherParticipant: UserPublic;
  lastMessageAt: ISODate | null;
  lastMessage: Pick<Message, "id" | "senderId" | "text" | "createdAt"> | null;
  unreadCount: number;
  createdAt: ISODate;
};

type ChatDetail = ChatSummary;

type ApiSuccess<T> = { success: true; data: T };
type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
};
type Paginated<T> = ApiSuccess<T[]> & {
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

type AiFilters = {
  category?: ShoeCategory | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  size?: number | null;
  excludeColors?: ShoeColor[];
  preferColors?: ShoeColor[];
};
type AiSearchResult = {
  mode: "ai" | "fallback";
  query: string;
  interpretedFilters: AiFilters | null;
  results: { shoe: ShoeSummary; reason: string | null }[];
  notice: string | null;
  meta: { totalItems: number; limit: number };
};
```

**Catatan tipe:** `ChatSummary.shoe` adalah snapshot ringkas dari shoe (termasuk listing yang soft-deleted) agar inbox tetap bisa ditampilkan. Lima URL foto dipakai pada `ShoeDetail`; hanya `imgUrl1` diperlukan untuk card/hasil AI. Semua contoh UUID/URL hanyalah dummy, bukan deployment sebenarnya.

**Request image berbeda dari response image:** file dikirim dalam `FormData` melalui key `images`, bukan field `imgUrl*`. Pada PUT, `retainedImageUrls` adalah JSON-string array di `FormData`; contoh lengkap pada §7.5.

### 15.2 Kontrak dasar fetch API di frontend

```ts
const API_URL = import.meta.env.VITE_API_URL;

async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 204) return undefined as T;

  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(body.error?.message ?? `HTTP ${response.status}`);
  }
  return body as T;
}

// contoh penggunaan:
// const catalog = await apiRequest<Paginated<ShoeSummary>>("/shoes?status=all");
// const chat = await apiRequest<ApiSuccess<ChatSummary>>(
//   "/chats", { method: "POST", body: JSON.stringify({ shoeId }) }, token
// );
// const created = await apiRequest<ApiSuccess<ShoeDetail>>(
//   "/shoes", { method: "POST", body: formData }, token
// ); // multipart: Content-Type diisi oleh browser
```

Error-handling produksi dapat memakai custom error yang menyimpan `status` dan `error.code`, sehingga UI bisa membedakan `401`, `409`, `422`, dan `429`; contoh ini hanya menunjukkan pola dasar.

### 15.3 Batas kontrak vs keputusan implementasi internal

**Wajib sama di tim**: route, method, enum, tipe field, status/error response, scope auth, signature event/payload/socket ACK, status lifecycle, uniqueness data, request flow penting.

**Boleh berbeda per modul** tanpa breaking change: nama folder internal, library komponen, CSS framework, pilihan service/controller organization, jenis state selector, query builder internal, strategi caching aman.

**Dokumentasi turunan yang sebaiknya dibuat dari README**: `docs/openapi.yaml` (atau Swagger/Postman collection dari endpoint §7), diagram database/migration, mock JSON untuk frontend, dan board issue yang mengikuti ID scenario di §13. Jangan merawat kontrak yang saling bertentangan: bila ada perbedaan, revisi bersama dan pilih satu sumber kebenaran.

---

**Penutup:** `README.md` ini adalah baseline *contract-first* untuk SoleSwap. PRD awal tetap menjadi referensi alasan produk; **keputusan Product Owner terbaru** berlaku, sementara detail wire contract versi ini masih menunggu persetujuan FE+BE pada §14. Setelah sign-off, tim dapat memakai dokumen ini sebagai kontrak implementasi final.
