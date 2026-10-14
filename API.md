# SoleSwap API

Dokumen ini menjelaskan kontrak REST API dan Socket.io yang benar-benar digunakan oleh aplikasi SoleSwap pada folder `server/` dan `client/`. Implementasi server adalah sumber kebenaran utama; keputusan produk dan alur pengguna tetap mengikuti `README.md` serta `README PRD rev.md`.

## 1. Ringkasan

| Item | Nilai |
|---|---|
| REST lokal | `http://localhost:3000` |
| Socket.io lokal | `http://localhost:3000` |
| Prefix REST | Tidak ada `/api` atau `/api/v1` |
| Format umum | JSON |
| Upload listing | `multipart/form-data` |
| Autentikasi | JWT Bearer |
| ID | UUID string |
| Waktu | ISO 8601 UTC |
| Mata uang | IDR, integer rupiah |
| Database | PostgreSQL melalui Sequelize |
| Realtime | Socket.io pada HTTP server yang sama |

URL production mengikuti environment masing-masing:

```dotenv
# client
VITE_API_URL=https://api.example.com
VITE_SOCKET_URL=https://api.example.com

# server
CLIENT_ORIGINS=https://app.example.com
```

`VITE_API_URL`, `VITE_SOCKET_URL`, dan `CLIENT_ORIGINS` tidak menggunakan trailing slash. Jika `VITE_SOCKET_URL` tidak diisi, client menggunakan nilai `VITE_API_URL`.

## 2. Konvensi HTTP

### 2.1 Header JSON

```http
Content-Type: application/json
Authorization: Bearer <accessToken>
```

`Authorization` hanya diwajibkan pada endpoint privat.

### 2.2 Header multipart

Untuk `POST /shoes` dan `PUT /shoes/:id`, kirim `FormData`. Jangan mengatur `Content-Type` secara manual karena browser atau Postman harus membuat boundary multipart.

```http
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data; boundary=<dibuat-client>
```

### 2.3 Success envelope

Objek tunggal:

```json
{
  "success": true,
  "data": {}
}
```

Daftar berpaginasi:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 12,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

### 2.4 Error envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data tidak valid",
    "details": [
      {
        "field": "size",
        "message": "size harus 35–50 dengan kelipatan 0,5"
      }
    ]
  }
}
```

`details` hanya disertakan jika tersedia dan status error di bawah `500`. Detail internal error server tidak dikirim kepada client.

### 2.5 Status HTTP utama

| Status | Arti |
|---|---|
| `200` | Request berhasil |
| `201` | Resource berhasil dibuat |
| `204` | Berhasil tanpa response body |
| `400` | JSON rusak |
| `401` | Token tidak ada, invalid, atau kedaluwarsa |
| `403` | User terautentikasi tetapi tidak berhak |
| `404` | Resource/route tidak ditemukan atau sengaja disembunyikan |
| `409` | Konflik status, duplikasi, atau idempotency |
| `413` | Body/file terlalu besar |
| `415` | Content type atau isi file tidak didukung |
| `422` | Validasi field/cursor gagal |
| `429` | Rate limit terlampaui |
| `500` | Error internal atau konfigurasi wajib tidak lengkap |
| `503` | Cloudinary/provider pendukung tidak tersedia |

## 3. Tipe data

### 3.1 Enum

```text
ShoeCategory = running | casual | basketball | formal | sneakers | other
ShoeCondition = like_new | good | fair
ShoeColor = black | white | gray | red | blue | green | yellow |
            brown | beige | purple | pink | orange | neon |
            multicolor | other
ShoeStatus = available | sold
```

### 3.2 UserPublic

```json
{
  "id": "10000000-0000-4000-8000-000000000001",
  "name": "Sinta"
}
```

### 3.3 UserSelf

```json
{
  "id": "10000000-0000-4000-8000-000000000001",
  "name": "Sinta",
  "email": "sinta@example.com",
  "createdAt": "2026-10-14T01:00:00.000Z"
}
```

Email hanya muncul pada data user sendiri.

### 3.4 ShoeSummary

```json
{
  "id": "20000000-0000-4000-8000-000000000001",
  "seller": {
    "id": "10000000-0000-4000-8000-000000000001",
    "name": "Sinta"
  },
  "imgUrl1": "https://res.cloudinary.com/example/image/upload/shoe.jpg",
  "brand": "Nike",
  "article": "Air Max 90",
  "category": "casual",
  "condition": "good",
  "size": 42,
  "color": "black",
  "price": 450000,
  "currency": "IDR",
  "status": "available",
  "createdAt": "2026-10-14T01:00:00.000Z",
  "updatedAt": "2026-10-14T01:00:00.000Z"
}
```

### 3.5 ShoeDetail

`ShoeDetail` berisi seluruh field `ShoeSummary` ditambah:

```json
{
  "imgUrl2": null,
  "imgUrl3": null,
  "imgUrl4": null,
  "imgUrl5": null,
  "description": "Kondisi baik dan jarang dipakai."
}
```

`description` hanya dikirim oleh endpoint detail. Daftar katalog dan hasil AI menggunakan `ShoeSummary`, sehingga tidak menyertakan description.

### 3.6 Message

```json
{
  "id": "40000000-0000-4000-8000-000000000001",
  "chatId": "30000000-0000-4000-8000-000000000001",
  "senderId": "10000000-0000-4000-8000-000000000002",
  "clientMessageId": "550e8400-e29b-41d4-a716-446655440000",
  "text": "Bisa COD besok?",
  "readAt": null,
  "createdAt": "2026-10-14T02:00:00.000Z"
}
```

### 3.7 ChatSummary / ChatDetail

REST chat list dan detail memakai bentuk data yang sama:

```json
{
  "id": "30000000-0000-4000-8000-000000000001",
  "shoe": {
    "id": "20000000-0000-4000-8000-000000000001",
    "brand": "Nike",
    "article": "Air Max 90",
    "imgUrl1": "https://res.cloudinary.com/example/image/upload/shoe.jpg",
    "status": "available",
    "isDeleted": false
  },
  "buyer": {
    "id": "10000000-0000-4000-8000-000000000002",
    "name": "Budi"
  },
  "seller": {
    "id": "10000000-0000-4000-8000-000000000001",
    "name": "Sinta"
  },
  "otherParticipant": {
    "id": "10000000-0000-4000-8000-000000000001",
    "name": "Sinta"
  },
  "lastMessageAt": "2026-10-14T02:00:00.000Z",
  "lastMessage": {
    "id": "40000000-0000-4000-8000-000000000001",
    "senderId": "10000000-0000-4000-8000-000000000002",
    "text": "Bisa COD besok?",
    "createdAt": "2026-10-14T02:00:00.000Z"
  },
  "unreadCount": 0,
  "createdAt": "2026-10-14T01:30:00.000Z"
}
```

`otherParticipant` dihitung berdasarkan user yang sedang meminta data. `lastMessageAt` dan `lastMessage` dapat bernilai `null`.

## 4. Ringkasan endpoint

| Method | Path | Auth | Fungsi |
|---|---|---:|---|
| `GET` | `/health` | Tidak | Liveness server |
| `POST` | `/register` | Tidak | Registrasi dan mendapatkan JWT |
| `POST` | `/login` | Tidak | Login dan mendapatkan JWT |
| `GET` | `/auth/me` | Ya | Memulihkan sesi user |
| `GET` | `/shoes` | Tidak | Katalog publik |
| `GET` | `/shoes/my-shoes` | Ya | Listing milik user |
| `GET` | `/shoes/:id` | Tidak | Detail listing |
| `POST` | `/shoes` | Ya | Membuat listing + upload foto |
| `PUT` | `/shoes/:id` | Owner | Full update listing + foto |
| `PATCH` | `/shoes/:id/status` | Owner | Mengubah available/sold |
| `DELETE` | `/shoes/:id` | Owner | Soft delete listing |
| `POST` | `/chats` | Ya | Mendapatkan/membuat chat unik |
| `GET` | `/chats` | Ya | Inbox user |
| `GET` | `/chats/:id` | Peserta | Detail chat |
| `GET` | `/chats/:id/messages` | Peserta | Histori pesan cursor-based |
| `PATCH` | `/chats/:id/read` | Peserta | Menandai pesan telah dibaca |
| `POST` | `/ai/search` | Tidak | Pencarian natural language |

## 5. Health

### `GET /health`

Auth: tidak diperlukan.

Response `200`:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "soleswap-api"
  }
}
```

Endpoint ini memeriksa proses Express, bukan koneksi database secara langsung.

## 6. Authentication

### 6.1 `POST /register`

Auth: tidak diperlukan.

Rate limit: maksimal 20 request per IP dalam 15 menit, digabung dengan `/login`.

Request:

```json
{
  "name": "Sinta",
  "email": "sinta@example.com",
  "password": "Rahasia123!"
}
```

Validasi:

| Field | Aturan |
|---|---|
| `name` | String setelah trim, 2–80 karakter |
| `email` | Format email valid, maksimal 320 karakter, dinormalisasi lowercase |
| `password` | 8–72 byte UTF-8 |

Field lain ditolak.

Response `201`:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "10000000-0000-4000-8000-000000000001",
      "name": "Sinta",
      "email": "sinta@example.com",
      "createdAt": "2026-10-14T01:00:00.000Z"
    },
    "accessToken": "<JWT>",
    "tokenType": "Bearer",
    "expiresIn": 86400
  }
}
```

Error khusus:

- `409 EMAIL_ALREADY_EXISTS`
- `422 VALIDATION_ERROR`
- `429 RATE_LIMITED`

### 6.2 `POST /login`

Auth: tidak diperlukan.

Request:

```json
{
  "email": "sinta@example.com",
  "password": "Rahasia123!"
}
```

Response `200` sama dengan data autentikasi pada register.

Error khusus:

- `401 INVALID_CREDENTIALS`
- `422 VALIDATION_ERROR`
- `429 RATE_LIMITED`

Server sengaja memakai pesan yang sama untuk email tidak ditemukan dan password salah.

### 6.3 `GET /auth/me`

Auth: wajib.

Response `200`:

```json
{
  "success": true,
  "data": {
    "id": "10000000-0000-4000-8000-000000000001",
    "name": "Sinta",
    "email": "sinta@example.com",
    "createdAt": "2026-10-14T01:00:00.000Z"
  }
}
```

Kemungkinan error:

- `401 UNAUTHORIZED`
- `401 TOKEN_EXPIRED`

Tidak ada endpoint refresh token atau logout server. Logout dilakukan client dengan menghapus token dan memutus Socket.io.

## 7. Shoes

### 7.1 Query katalog

Endpoint `GET /shoes` dan `GET /shoes/my-shoes` menerima query berikut:

| Query | Default | Aturan |
|---|---:|---|
| `page` | `1` | Integer minimal 1 |
| `limit` | `12` | Integer 1–50 |
| `status` | `all` | `all`, `available`, atau `sold` |
| `sort` | `newest` | `newest`, `price_asc`, atau `price_desc` |
| `brand` | — | Case-insensitive substring |
| `size` | — | 35–50 dengan kelipatan 0,5 |
| `category` | — | Salah satu `ShoeCategory` |
| `q` | — | Case-insensitive substring pada brand, article, atau description |

Contoh:

```http
GET /shoes?page=1&limit=12&status=available&category=running&size=42&sort=price_asc
```

### 7.2 `GET /shoes`

Auth: tidak diperlukan.

Response `200`:

```json
{
  "success": true,
  "data": [
    {
      "id": "20000000-0000-4000-8000-000000000001",
      "seller": {
        "id": "10000000-0000-4000-8000-000000000001",
        "name": "Sinta"
      },
      "imgUrl1": "https://res.cloudinary.com/example/image/upload/shoe.jpg",
      "brand": "Nike",
      "article": "Air Max 90",
      "category": "casual",
      "condition": "good",
      "size": 42,
      "color": "black",
      "price": 450000,
      "currency": "IDR",
      "status": "available",
      "createdAt": "2026-10-14T01:00:00.000Z",
      "updatedAt": "2026-10-14T01:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 12,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

Status default adalah `all`, sehingga listing available dan sold dapat tampil. Listing yang telah soft-delete tidak tampil.

### 7.3 `GET /shoes/my-shoes`

Auth: wajib.

Query dan response sama dengan katalog, tetapi hanya mengembalikan listing milik user dari JWT.

### 7.4 `GET /shoes/:id`

Auth: tidak diperlukan.

Parameter `id` wajib UUID valid.

Response `200`: `ShoeDetail`.

Error:

- `404 SHOE_NOT_FOUND`
- `422 VALIDATION_ERROR` jika ID bukan UUID

Listing sold masih dapat dilihat. Listing soft-delete menghasilkan `404`.

### 7.5 Field listing

Field berikut wajib pada create dan update:

| Field multipart | Aturan |
|---|---|
| `brand` | 2–60 karakter setelah trim |
| `article` | 2–120 karakter setelah trim |
| `category` | Salah satu `ShoeCategory` |
| `condition` | Salah satu `ShoeCondition` |
| `size` | Angka 35–50, kelipatan 0,5 |
| `color` | Salah satu `ShoeColor` |
| `description` | 10–2.000 karakter setelah trim |
| `price` | Integer 1–100.000.000 |
| `images` | File berulang; aturan berbeda pada create/update |

`status`, `userId`, `imgUrl*`, dan field lain tidak boleh dikirim oleh client.

Aturan gambar:

- Format JPEG, PNG, atau WebP.
- MIME harus sesuai dengan magic bytes file.
- Maksimal 5 MB per file.
- Maksimal 5 file per request.
- Server menyimpan file ke Cloudinary.

### 7.6 `POST /shoes`

Auth: wajib.

Content type: `multipart/form-data`.

Minimal satu dan maksimal lima file `images` wajib dikirim. Status awal selalu `available`.

Contoh JavaScript:

```js
const formData = new FormData();
formData.set("brand", "Nike");
formData.set("article", "Air Max 90");
formData.set("category", "casual");
formData.set("condition", "good");
formData.set("size", "42");
formData.set("color", "black");
formData.set("description", "Kondisi baik dan jarang dipakai.");
formData.set("price", "450000");
formData.append("images", file1);
formData.append("images", file2);

await fetch(`${API_URL}/shoes`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
```

Response `201`: `ShoeDetail`.

Rate limit: maksimal 60 request upload per IP dalam 1 jam, digabung dengan endpoint update.

### 7.7 `PUT /shoes/:id`

Auth: wajib dan harus owner.

Content type: `multipart/form-data`.

Ini adalah full update, bukan partial update. Semua field listing pada tabel di atas wajib dikirim kembali.

Field tambahan wajib:

```text
retainedImageUrls = JSON-string array
```

Contoh mempertahankan dua URL lama dan menambah satu gambar:

```js
formData.set("retainedImageUrls", JSON.stringify([
  shoe.imgUrl1,
  shoe.imgUrl2,
]));
formData.append("images", newFile);
```

Aturan:

- Setiap URL retained harus benar-benar milik listing tersebut.
- URL retained tidak boleh duplikat.
- Urutan URL retained dipertahankan.
- Gambar baru ditempatkan setelah gambar retained.
- Jumlah akhir gambar harus 1–5.
- Untuk menghapus seluruh gambar lama, kirim `retainedImageUrls` sebagai `[]` dan minimal satu file baru.

Response `200`: `ShoeDetail` terbaru.

Error khusus:

- `403 FORBIDDEN` jika bukan owner
- `404 SHOE_NOT_FOUND`
- `415 UNSUPPORTED_MEDIA_TYPE`
- `422 VALIDATION_ERROR`
- `503 SERVICE_UNAVAILABLE` jika upload Cloudinary gagal

### 7.8 `PATCH /shoes/:id/status`

Auth: wajib dan harus owner.

Request:

```json
{
  "status": "sold"
}
```

Nilai yang diterima hanya `available` atau `sold` dalam huruf kecil. Field lain ditolak.

Response `200`: `ShoeDetail` terbaru.

### 7.9 `DELETE /shoes/:id`

Auth: wajib dan harus owner.

Server melakukan soft delete. Response sukses adalah `204 No Content` tanpa JSON body.

Efek bisnis:

- Listing tidak muncul di katalog/detail.
- Chat lama tetap dapat dibaca.
- Pesan baru pada chat tersebut ditolak dengan `409 SHOE_DELETED`.
- Pengulangan delete oleh owner bersifat aman selama record masih dapat ditemukan secara paranoid-disabled.

## 8. Chats REST API

Semua endpoint `/chats` memerlukan JWT.

### 8.1 `POST /chats`

Membuat atau mengambil chat unik untuk pasangan `(shoeId, buyerId)`.

Request:

```json
{
  "shoeId": "20000000-0000-4000-8000-000000000001"
}
```

Response:

- `201` jika chat baru dibuat.
- `200` jika chat yang sama sudah ada.
- Data berupa `ChatSummary`.

Aturan:

- User tidak dapat membuat chat pada listing sendiri.
- Chat baru hanya dapat dibuat jika listing masih `available` dan belum terhapus.
- Jika chat sudah pernah dibuat, chat yang sama dikembalikan terlebih dahulu, termasuk saat listing kemudian sold/terhapus.

Error khusus:

- `403 SELF_CHAT_NOT_ALLOWED`
- `404 SHOE_NOT_FOUND`
- `409 SHOE_NOT_AVAILABLE`

Simpan `data.id` dari response sebagai `chatId` untuk REST messages dan Socket.io.

### 8.2 `GET /chats`

Mengembalikan inbox user sebagai buyer maupun seller.

Query:

| Query | Default | Aturan |
|---|---:|---|
| `page` | `1` | Integer minimal 1 |
| `limit` | `12` | Integer 1–50 |

Response `200`: daftar `ChatSummary` beserta metadata pagination.

Urutan utama adalah `lastMessageAt` terbaru, lalu waktu pembuatan chat terbaru.

### 8.3 `GET /chats/:id`

Auth: wajib dan harus buyer atau seller pada chat tersebut.

Response `200`: `ChatDetail`.

Untuk mencegah IDOR, chat yang tidak ada atau bukan milik user sama-sama menghasilkan:

```json
{
  "success": false,
  "error": {
    "code": "CHAT_NOT_FOUND",
    "message": "Chat tidak ditemukan"
  }
}
```

### 8.4 `GET /chats/:id/messages`

Mengambil histori pesan dengan cursor.

Query:

| Query | Default | Aturan |
|---|---:|---|
| `limit` | `30` | Integer 1–100 |
| `before` | — | UUID message untuk mengambil pesan lebih lama |
| `after` | — | UUID message untuk mengambil pesan lebih baru |

`before` dan `after` tidak boleh digunakan bersamaan. Cursor harus merupakan message dari chat yang sama.

Response `200`:

```json
{
  "success": true,
  "data": [
    {
      "id": "40000000-0000-4000-8000-000000000001",
      "chatId": "30000000-0000-4000-8000-000000000001",
      "senderId": "10000000-0000-4000-8000-000000000002",
      "clientMessageId": "550e8400-e29b-41d4-a716-446655440000",
      "text": "Bisa COD besok?",
      "readAt": null,
      "createdAt": "2026-10-14T02:00:00.000Z"
    }
  ],
  "meta": {
    "limit": 30,
    "hasMore": false,
    "nextCursor": null
  }
}
```

Data selalu dikembalikan dalam urutan kronologis lama → baru pada setiap batch.

Pola client:

- Initial/latest: `GET /chats/:id/messages?limit=30`
- Pesan lama: `?limit=30&before=<nextCursor>`
- Sinkronisasi setelah reconnect: `?limit=30&after=<lastKnownMessageId>`

Error khusus:

- `422 INVALID_CURSOR`
- `422 VALIDATION_ERROR`
- `404 CHAT_NOT_FOUND`

### 8.5 `PATCH /chats/:id/read`

Menandai pesan dari lawan bicara sebagai telah dibaca.

Menandai seluruh pesan unread:

```json
{}
```

Atau menandai sampai message tertentu secara inklusif:

```json
{
  "lastReadMessageId": "40000000-0000-4000-8000-000000000001"
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "chatId": "30000000-0000-4000-8000-000000000001",
    "readCount": 2,
    "unreadCount": 0
  }
}
```

Operasi yang sama juga tersedia melalui event Socket.io `chat:read`.

## 9. AI Search

### `POST /ai/search`

Auth: tidak diperlukan.

Rate limit: maksimal 10 request per IP per menit.

Request minimum:

```json
{
  "query": "sepatu lari warna putih ukuran di atas 40 dengan harga di bawah 1 juta"
}
```

Request lengkap:

```json
{
  "query": "sepatu lari warna putih ukuran di atas 40 dengan harga di bawah 1 juta",
  "limit": 12,
  "filterOverrides": {
    "condition": "good",
    "maxPrice": 1000000,
    "colors": ["white"]
  }
}
```

Validasi:

| Field | Aturan |
|---|---|
| `query` | String setelah trim, 3–300 karakter |
| `limit` | Integer 1–20, default 12 |
| `filterOverrides` | Object, default `{}` |

Filter override yang didukung:

| Key | Nilai |
|---|---|
| `brand` | String 2–60 karakter atau `null` |
| `category` | `ShoeCategory` atau `null` |
| `condition` | `ShoeCondition` atau `null` |
| `minPrice` | Integer 1–100.000.000 atau `null` |
| `maxPrice` | Integer 1–100.000.000 atau `null` |
| `size` | Angka 35–50 kelipatan 0,5 atau `null` |
| `minSize` | Angka 35–50 kelipatan 0,5 atau `null` |
| `maxSize` | Angka 35–50 kelipatan 0,5 atau `null` |
| `colors` | Array `ShoeColor` |
| `excludeColors` | Array `ShoeColor` |
| `preferColors` | Array `ShoeColor` |

`colors` adalah filter keras. `excludeColors` menolak warna. `preferColors` hanya memengaruhi ranking.

Response `200` mode AI:

```json
{
  "success": true,
  "data": {
    "mode": "ai",
    "query": "sepatu lari warna putih ukuran di atas 40 dengan harga di bawah 1 juta",
    "interpretedFilters": {
      "category": "running",
      "maxPrice": 1000000,
      "minSize": 40.5,
      "colors": ["white"]
    },
    "results": [
      {
        "shoe": {
          "id": "20000000-0000-4000-8000-000000000001",
          "seller": {
            "id": "10000000-0000-4000-8000-000000000001",
            "name": "Sinta"
          },
          "imgUrl1": "https://res.cloudinary.com/example/image/upload/shoe.jpg",
          "brand": "ASICS",
          "article": "GEL-1130",
          "category": "running",
          "condition": "good",
          "size": 42,
          "color": "white",
          "price": 900000,
          "currency": "IDR",
          "status": "available",
          "createdAt": "2026-10-14T01:00:00.000Z",
          "updatedAt": "2026-10-14T01:00:00.000Z"
        },
        "reason": "kategori running, harga Rp900.000 sesuai batas, ukuran EU 42 sesuai rentang, warna white."
      }
    ],
    "notice": null,
    "meta": {
      "totalItems": 1,
      "limit": 12
    }
  }
}
```

Semua hasil AI selalu berstatus `available`.

Perilaku pencarian:

- Brand yang ada di katalog diperlakukan sebagai filter exact case-insensitive.
- Kondisi, warna, harga, dan ukuran eksplisit menjadi filter keras.
- `di atas 40` berarti minimal ukuran `40.5`.
- Kebutuhan olahraga/gym/latihan dipetakan ke `running`.
- Kebutuhan kampus/harian dipetakan ke `casual`.
- Kebutuhan formal/wawancara/acara resmi dipetakan ke `formal`.
- Kebutuhan gabungan harian dan olahraga memprioritaskan `running`.
- Prompt tidak relevan tidak boleh menampilkan seluruh katalog secara acak.

Jika tidak ada hasil:

```json
{
  "mode": "ai",
  "results": [],
  "notice": "Sepatu tidak ditemukan. Masukkan prompt yang berkaitan dengan sepatu atau tuliskan kebutuhan sepatu Anda."
}
```

Jika Gemini/provider gagal, endpoint tetap merespons `200` menggunakan filter lokal:

```json
{
  "success": true,
  "data": {
    "mode": "fallback",
    "query": "sepatu di bawah 1 juta",
    "interpretedFilters": null,
    "results": [],
    "notice": "Pencarian AI sedang tidak tersedia. Sepatu tidak ditemukan. Masukkan prompt yang berkaitan dengan sepatu atau tuliskan kebutuhan sepatu Anda.",
    "meta": {
      "totalItems": 0,
      "limit": 12
    }
  }
}
```

Jika fallback menemukan listing, `notice` berisi `Pencarian AI sedang tidak tersedia; hasil memakai pencarian terstruktur lokal.`

Mode fallback bukan HTTP error. Client tetap harus membaca `data.mode` dan `data.notice`.

## 10. Socket.io

### 10.1 Koneksi

Socket.io memakai host yang sama dengan REST.

Authenticated socket:

```js
import { io } from "socket.io-client";

const socket = io(SOCKET_URL, {
  auth: { token: accessToken },
});
```

Guest socket:

```js
const socket = io(SOCKET_URL);
```

Guest boleh bergabung ke katalog/listing room, tetapi tidak boleh menggunakan event chat privat. Jika token dikirim tetapi invalid/kedaluwarsa, handshake gagal melalui `connect_error`:

```json
{
  "code": "UNAUTHORIZED",
  "message": "Token socket tidak valid atau kedaluwarsa"
}
```

Socket authenticated otomatis bergabung ke room internal `user:<userId>`. Token yang kedaluwarsa ketika koneksi masih hidup akan menyebabkan event privat mengembalikan `TOKEN_EXPIRED`, kemudian socket diputus.

### 10.2 Kontrak ACK

Semua event client → server menggunakan acknowledgement.

Sukses:

```json
{
  "success": true,
  "data": {}
}
```

Gagal:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data tidak valid"
  }
}
```

Contoh helper client:

```js
function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit(event, payload, (timeoutError, response) => {
      if (timeoutError) return reject(timeoutError);
      if (!response?.success) return reject(response.error);
      resolve(response.data);
    });
  });
}
```

### 10.3 Event client → server

#### `catalog:join`

Auth: guest/authenticated.

Payload:

```json
{}
```

ACK data:

```json
{ "joined": true }
```

Mendaftarkan socket untuk menerima perubahan katalog global.

#### `catalog:leave`

Payload `{}`. ACK data `{ "joined": false }`.

#### `listing:join`

Auth: guest/authenticated.

Payload:

```json
{
  "shoeId": "20000000-0000-4000-8000-000000000001"
}
```

ACK data:

```json
{
  "joined": true,
  "shoeId": "20000000-0000-4000-8000-000000000001"
}
```

Maksimal 50 listing subscription aktif per socket.

#### `listing:leave`

Payload berisi `shoeId`. ACK data berisi `joined: false` dan `shoeId`.

#### `chat:join`

Auth: wajib dan harus peserta chat.

Payload:

```json
{
  "chatId": "30000000-0000-4000-8000-000000000001"
}
```

ACK data:

```json
{
  "joined": true,
  "chatId": "30000000-0000-4000-8000-000000000001"
}
```

Jika bukan peserta, ACK gagal dengan `403 FORBIDDEN`.

#### `chat:leave`

Auth: wajib dan harus peserta. ACK mengembalikan `joined: false` dan `chatId`.

#### `message:send`

Auth: wajib dan harus peserta chat.

Payload:

```json
{
  "chatId": "30000000-0000-4000-8000-000000000001",
  "clientMessageId": "550e8400-e29b-41d4-a716-446655440000",
  "text": " Bisa COD besok? "
}
```

Validasi:

- `chatId` UUID.
- `clientMessageId` UUID yang dibuat client.
- `text` string 1–2.000 karakter setelah trim.
- Listing soft-delete membuat chat read-only.
- Listing sold tetap dapat memakai chat lama untuk koordinasi.

ACK data:

```json
{
  "message": {
    "id": "40000000-0000-4000-8000-000000000001",
    "chatId": "30000000-0000-4000-8000-000000000001",
    "senderId": "10000000-0000-4000-8000-000000000002",
    "clientMessageId": "550e8400-e29b-41d4-a716-446655440000",
    "text": "Bisa COD besok?",
    "readAt": null,
    "createdAt": "2026-10-14T02:00:00.000Z"
  }
}
```

Idempotency:

- Retry dengan sender, `clientMessageId`, chat, dan text yang sama mengembalikan message yang sama.
- UUID yang sama dengan payload berbeda menghasilkan `409 IDEMPOTENCY_CONFLICT`.
- Client harus mempertahankan `clientMessageId` yang sama saat retry message gagal/timeout.

#### `typing:start` dan `typing:stop`

Auth: wajib dan harus peserta.

Payload:

```json
{
  "chatId": "30000000-0000-4000-8000-000000000001"
}
```

ACK data:

```json
{
  "chatId": "30000000-0000-4000-8000-000000000001",
  "isTyping": true
}
```

`typing:stop` mengembalikan `isTyping: false`.

#### `chat:read`

Auth: wajib dan harus peserta.

Menandai semua pesan unread:

```json
{
  "chatId": "30000000-0000-4000-8000-000000000001"
}
```

Atau sampai message tertentu:

```json
{
  "chatId": "30000000-0000-4000-8000-000000000001",
  "lastReadMessageId": "40000000-0000-4000-8000-000000000001"
}
```

ACK data:

```json
{
  "chatId": "30000000-0000-4000-8000-000000000001",
  "readCount": 2,
  "unreadCount": 0
}
```

### 10.4 Event server → client

#### `listing:created`

Dikirim ke room katalog saat listing baru berhasil dibuat.

```json
{
  "shoe": {
    "id": "20000000-0000-4000-8000-000000000001",
    "seller": { "id": "10000000-0000-4000-8000-000000000001", "name": "Sinta" },
    "imgUrl1": "https://res.cloudinary.com/example/image/upload/shoe.jpg",
    "brand": "Nike",
    "article": "Air Max 90",
    "category": "casual",
    "condition": "good",
    "size": 42,
    "color": "black",
    "price": 450000,
    "currency": "IDR",
    "status": "available",
    "createdAt": "2026-10-14T01:00:00.000Z",
    "updatedAt": "2026-10-14T01:00:00.000Z"
  }
}
```

#### `listing:updated`

```json
{
  "shoeId": "20000000-0000-4000-8000-000000000001",
  "updatedAt": "2026-10-14T02:00:00.000Z"
}
```

Client sebaiknya refetch detail/katalog karena payload tidak berisi seluruh listing.

#### `listing:status`

```json
{
  "shoeId": "20000000-0000-4000-8000-000000000001",
  "status": "sold",
  "updatedAt": "2026-10-14T02:00:00.000Z"
}
```

#### `listing:deleted`

```json
{
  "shoeId": "20000000-0000-4000-8000-000000000001",
  "deletedAt": "2026-10-14T02:00:00.000Z"
}
```

Event listing dikirim ke room terkait dan user yang menjadi seller/buyer pada chat listing tersebut.

#### `chat:created`

Payload berupa `ChatSummary` yang diserialisasi sesuai penerima. Dikirim ke room user buyer dan seller ketika chat baru dibuat.

#### `message:new`

Payload berupa `Message`. Dikirim ke seluruh socket pada room chat setelah message berhasil disimpan ke database.

#### `notification:new`

Dikirim ke room user penerima:

```json
{
  "chatId": "30000000-0000-4000-8000-000000000001",
  "message": {},
  "unreadCount": 1
}
```

`message` mengikuti tipe `Message`.

#### `unread:update`

```json
{
  "totalUnread": 4,
  "chatId": "30000000-0000-4000-8000-000000000001",
  "unreadCount": 1
}
```

`totalUnread` adalah total seluruh chat user. `unreadCount` hanya untuk `chatId` terkait.

#### `typing:update`

```json
{
  "chatId": "30000000-0000-4000-8000-000000000001",
  "userId": "10000000-0000-4000-8000-000000000002",
  "isTyping": true
}
```

Event dikirim kepada peserta lain di room, bukan kembali kepada pengirim.

#### `chat:read:updated`

```json
{
  "chatId": "30000000-0000-4000-8000-000000000001",
  "readerId": "10000000-0000-4000-8000-000000000001",
  "lastReadMessageId": null
}
```

`lastReadMessageId: null` berarti operasi read tidak dibatasi cursor.

#### `presence:update`

```json
{
  "userId": "10000000-0000-4000-8000-000000000001",
  "online": true
}
```

Presence hanya disebarkan kepada user yang pernah memiliki chat dengan user tersebut. Presence berada di memory satu proses server.

### 10.5 Batas Socket.io

| Batas | Nilai default |
|---|---:|
| Koneksi per IP | `SOCKET_MAX_CONNECTIONS_PER_IP=20` |
| Event public per socket | 60/menit |
| Event private per socket | 120/menit |
| Listing subscriptions | 50/socket |
| Socket payload | 100 KB |
| ACK timeout client saat ini | 5 detik |

Implementasi realtime saat ini ditujukan untuk satu proses/instance. Multi-instance memerlukan adapter terdistribusi seperti Redis untuk room, presence, dan event lintas instance.

## 11. Error code reference

| Code | Status umum | Keterangan |
|---|---:|---|
| `BAD_REQUEST` | 400 | JSON request rusak |
| `UNAUTHORIZED` | 401 | Token tidak ada/invalid atau socket tidak authenticated |
| `TOKEN_EXPIRED` | 401 | JWT kedaluwarsa |
| `INVALID_CREDENTIALS` | 401 | Email/password login salah |
| `FORBIDDEN` | 403 | Tidak memiliki hak akses |
| `SELF_CHAT_NOT_ALLOWED` | 403 | Membuat chat pada listing sendiri |
| `NOT_FOUND` | 404 | Route tidak ditemukan |
| `SHOE_NOT_FOUND` | 404 | Listing tidak ditemukan/terhapus |
| `CHAT_NOT_FOUND` | 404 | Chat tidak ditemukan atau bukan peserta |
| `EMAIL_ALREADY_EXISTS` | 409 | Email register sudah digunakan |
| `CONFLICT` | 409 | Konflik constraint umum |
| `SHOE_NOT_AVAILABLE` | 409 | Listing tidak available untuk chat baru |
| `SHOE_DELETED` | 409 | Chat listing terhapus menjadi read-only |
| `IDEMPOTENCY_CONFLICT` | 409 | `clientMessageId` dipakai untuk payload berbeda |
| `FILE_TOO_LARGE` | 413 | File/body melebihi batas |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Multipart atau format gambar tidak valid |
| `VALIDATION_ERROR` | 422 | Field, UUID, enum, atau pagination invalid |
| `INVALID_CURSOR` | 422 | Cursor bukan bagian dari chat |
| `RATE_LIMITED` | 429 | Rate/event/connection limit tercapai |
| `INTERNAL_SERVER_ERROR` | 500 | Error internal disamarkan |
| `SERVER_MISCONFIGURED` | 500 | JWT secret server tidak valid |
| `SERVICE_UNAVAILABLE` | 503 | Cloudinary belum tersedia/gagal |

## 12. Rate limit dan batas request

| Area | Batas |
|---|---:|
| Register + login | 20 request/IP/15 menit |
| Create + update listing | 60 request/IP/jam |
| AI search | 10 request/IP/menit |
| JSON/urlencoded body | 100 KB |
| Gambar | 5 MB/file, maksimal 5 file |

Server mengirim standard rate-limit headers draft-8 pada REST endpoint yang memakai limiter.

## 13. Contoh alur integrasi client

### 13.1 Memulihkan sesi

1. Ambil token dari penyimpanan client.
2. Panggil `GET /auth/me`.
3. Jika `401`, hapus token dan putuskan socket.
4. Jika sukses, hubungkan Socket.io dengan `auth.token`.

### 13.2 Membuka chat dari detail sepatu

1. Guest login/register terlebih dahulu.
2. Client mengirim `POST /chats` dengan `shoeId`.
3. Ambil `data.id` sebagai `chatId`.
4. Navigasi ke `/chats/:chatId`.
5. Hubungkan socket dan emit `chat:join`.
6. Ambil detail chat dan histori message lewat REST.

### 13.3 Mengirim message secara optimistic

1. Buat `clientMessageId` dengan `crypto.randomUUID()`.
2. Tampilkan optimistic message dengan status `sending`.
3. Emit `message:send` dan tunggu ACK.
4. Gabungkan message ACK berdasarkan `id` atau pasangan `senderId + clientMessageId`.
5. Jika timeout, tandai `failed`.
6. Retry menggunakan `clientMessageId` dan text yang sama.

### 13.4 Reconnect chat

1. Setelah socket connect kembali, emit `chat:join` lagi.
2. Ambil message setelah message terakhir melalui `after=<messageId>`.
3. Ambil batch terbaru bila diperlukan.
4. Deduplicate berdasarkan `message.id`/`clientMessageId`.
5. Emit `chat:read` jika room sedang aktif.

## 14. Catatan Postman

- Pilih Body → raw → JSON untuk endpoint JSON.
- Untuk endpoint privat, gunakan Authorization → Bearer Token.
- Untuk `POST /shoes`/`PUT /shoes/:id`, pilih Body → form-data.
- Ubah tipe key `images` dari Text menjadi File; key yang sama dapat ditambahkan beberapa kali.
- Pada update, `retainedImageUrls` tetap bertipe Text dan nilainya JSON array, misalnya `["https://..."]`.
- Request status yang benar:

```json
{
  "status": "sold"
}
```

- Socket.io bukan WebSocket mentah. Untuk pengujian kontrak Socket.io, gunakan client Socket.io, halaman client, atau script Node dengan `socket.io-client`; fitur WebSocket generik Postman tidak selalu mereplikasi protokol Socket.io dan ACK dengan tepat.
