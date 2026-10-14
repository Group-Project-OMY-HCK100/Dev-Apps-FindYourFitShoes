# SoleSwap API

Backend Express + PostgreSQL/Sequelize + Socket.io untuk kontrak pada `README PRD rev.md` di root repo. Seluruh REST route tidak memakai prefix `/api/v1`.

## Menjalankan lokal

1. Salin `.env.example` menjadi `.env`, lalu isi PostgreSQL, JWT, Cloudinary, dan Gemini.
2. Jalankan `npm install`.
3. Jalankan `npm run db:migrate`.
4. Opsional: jalankan `npm run db:seed` untuk memasukkan data dari `db/users.json` dan `db/shoes.json`.
5. Jalankan `npm run dev`.

Perintah verifikasi:

```text
npm run lint
npm test
npx sequelize-cli db:create --env test
npm run db:migrate -- --env test
npm run test:integration
```

`test:integration` memakai database test terpisah, mengosongkan tabel di database tersebut, dan memalsukan respons Cloudinary agar tidak mengunggah aset sungguhan. Jangan arahkan konfigurasi environment `test` ke database berisi data penting.
Gunakan `TEST_DATABASE_URL` bila test database berada pada koneksi khusus. Jika variabel itu kosong, environment test memakai database lokal `database_test_apps_findyourfitshoes` dan tidak pernah memakai `DATABASE_URL` development.

Konfigurasi Gemini yang dipakai AI search:

```dotenv
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_private_gemini_key
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_THINKING_LEVEL=low
AI_TIMEOUT_MS=8000
```

Provider `openai` dan `openai-compatible` tetap didukung melalui `LLM_API_KEY`, `LLM_MODEL`, dan `LLM_BASE_URL`. Jika provider gagal, timeout, atau menghasilkan JSON invalid, `POST /ai/search` tetap sukses dalam mode `fallback` sesuai PRD.
Batas harga eksplisit berbahasa Indonesia seperti `di bawah 1 juta`, `maksimal 750 ribu`, atau `di atas Rp500.000` divalidasi ulang oleh server dan tetap diterapkan ketika provider masuk mode fallback.
Brand yang ada di katalog, kondisi, warna eksplisit, ukuran exact, dan rentang ukuran seperti `di atas 40` juga diterapkan sebagai filter keras oleh server. Prompt yang tidak mempunyai kecocokan tidak mengembalikan katalog acak; respons berisi `results: []` dan `notice` yang meminta pengguna menuliskan kebutuhan sepatu.
Error Gemini sementara (`429`/`5xx`) atau structured JSON yang rusak dicoba ulang sekali dengan jeda singkat selama masih berada dalam batas `AI_TIMEOUT_MS`.

## Endpoint

- Auth: `POST /register`, `POST /login`, `GET /auth/me`
- Shoes: `GET /shoes`, `GET /shoes/my-shoes`, `GET /shoes/:id`, `POST /shoes`, `PUT /shoes/:id`, `PATCH /shoes/:id/status`, `DELETE /shoes/:id`
- Chats: `POST /chats`, `GET /chats`, `GET /chats/:id`, `GET /chats/:id/messages`, `PATCH /chats/:id/read`
- AI dan health: `POST /ai/search`, `GET /health`

`POST /shoes` dan `PUT /shoes/:id` wajib `multipart/form-data` dengan file berulang bernama `images`. Update juga wajib mengirim `retainedImageUrls` sebagai JSON-string array.

## Data seed JSON

- `db/users.json` adalah sumber user demo. Nilai `password` akan di-hash dengan bcrypt sebelum disimpan; password mentah tidak dimasukkan ke database.
- `db/shoes.json` adalah sumber sepatu demo. `user_id` berupa nomor urut user (mulai dari `1`) di `users.json`, lalu seeder mengubahnya menjadi UUID yang sesuai dengan schema PostgreSQL.
- Seeder memvalidasi isi kedua file dan menjalankan insert user serta sepatu dalam satu transaction.
- Jika versi seed lama sudah pernah dijalankan, jalankan `npm run db:seed:undo`, lalu `npm run db:seed` agar data diganti dari kedua file JSON.

## Catatan deployment

- Jalankan pada proses Node long-running yang mendukung WebSocket.
- Jalankan migration sebelum start aplikasi.
- Isi `CLIENT_ORIGINS` dengan daftar origin frontend yang dipisahkan koma; wildcard tidak digunakan.
- Jangan commit `.env`. Secret Cloudinary dan LLM hanya berada di server.
- File JSON di `db/` hanya menjadi sumber data seed. Setelah proses seed, PostgreSQL tetap menjadi source of truth aplikasi.
- Untuk lebih dari satu instance aplikasi, tambahkan adapter Socket.io terdistribusi (misalnya Redis) sebelum scale-out.
