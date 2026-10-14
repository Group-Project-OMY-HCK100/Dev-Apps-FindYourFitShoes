import { useState } from "react";
import { Link } from "react-router";
import Icon from "./Icon";
import { categories, conditions, colors, shoeImages } from "../data/products";

export default function ProductForm({ product, onCreate, onUpdate, pending = false, error = "" }) {
  const [photos, setPhotos] = useState(() => product ? shoeImages(product).map((url) => ({ id: url, url })) : []);
  const [notice, setNotice] = useState("");
  const [reading, setReading] = useState(false);

  async function selectPhotos(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (files.length + photos.length > 5) { setNotice("Maksimal 5 foto termasuk foto lama yang dipertahankan."); return; }
    if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) { setNotice("Gunakan JPG, PNG, atau WebP, maksimal 5 MB per foto."); return; }
    setReading(true);
    setNotice("");
    try {
      const previews = await Promise.all(files.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ id: crypto.randomUUID(), url: reader.result, file });
        reader.onerror = () => reject(new Error("Foto tidak bisa dibaca. Coba pilih lagi."));
        reader.readAsDataURL(file);
      })));
      setPhotos((current) => [...current, ...previews]);
    } catch (error) { setNotice(error.message); }
    finally { setReading(false); }
  }

  function submit(event) {
    event.preventDefault();
    if (reading || pending) return;
    if (!photos.length) { setNotice("Tambahkan minimal 1 foto sepatu."); return; }
    const save = product ? onUpdate : onCreate;
    if (!save) {
      setNotice("Preview saja. Perubahan belum dikirim ke server.");
      return;
    }
    setNotice("");
    const formData = new FormData(event.currentTarget);
    ["brand", "article", "description"].forEach((field) => {
      formData.set(field, String(formData.get(field)).trim());
    });
    if (product) {
      const retainedImageUrls = photos.filter((photo) => !photo.file).map((photo) => photo.url);
      formData.append("retainedImageUrls", JSON.stringify(retainedImageUrls));
    }
    photos.filter((photo) => photo.file).forEach((photo) => formData.append("images", photo.file));
    save(formData);
  }

  return <section className="form-page">
    <Link to="/my-shoes" className="back-link">← Kembali ke My Shoes</Link>
    <div className="page-heading"><span className="eyebrow">{product ? "EDIT LISTING" : "JUAL SEPATU"}</span><h1>{product ? "Perbarui listing kamu." : "Tambahkan sepatu."}</h1><p>Foto yang jelas dan detail kondisi membantu pembeli memilih dengan yakin.</p></div>
    <form onSubmit={submit} aria-busy={pending}>
      <fieldset className="product-form product-form-fields" disabled={pending}>
      <div className="form-main">
        <section className="form-panel"><h2><span>01</span> Foto sepatu</h2><p>Tambahkan 1–5 foto. Foto pertama menjadi foto utama di katalog.</p>
          <div className="photo-previews">{photos.map((photo, index) => <div className="photo-preview" key={photo.id}><img src={photo.url} alt={`Preview foto sepatu ${index + 1}`} /><span>{index === 0 ? "Utama" : `Foto ${index + 1}`}</span><button type="button" disabled={reading} aria-label={`Hapus foto ${index + 1}`} onClick={() => setPhotos(photos.filter((item) => item.id !== photo.id))}>×</button>{index > 0 && <button type="button" className="make-primary" disabled={reading || Boolean(photo.file && photos.some((item) => !item.file))} title={photo.file && photos.some((item) => !item.file) ? "Hapus semua foto lama jika ingin memakai foto baru sebagai foto utama" : "Jadikan foto utama"} onClick={() => setPhotos([photo, ...photos.filter((item) => item.id !== photo.id)])}>Jadikan utama</button>}</div>)}</div>
          <label className={`upload-zone multi-upload ${reading || photos.length === 5 ? "disabled" : ""}`}><Icon name="upload" size={26} /><strong>{reading ? "Menyiapkan preview…" : photos.length === 5 ? "5 foto sudah dipilih" : "Pilih foto sepatu"}</strong><span>JPG, PNG atau WebP · Maks. 5 MB per foto · {photos.length}/5</span><input disabled={reading || photos.length === 5} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectPhotos} /></label>
          {product && <p className="photo-help">Foto lama yang dipertahankan disimpan lebih dulu, kemudian foto baru. Untuk menjadikan foto baru sebagai foto utama, hapus seluruh foto lama terlebih dahulu.</p>}
        </section>
        <section className="form-panel"><h2><span>02</span> Detail sepatu</h2><div className="field-grid">
          <label>Merek<input name="brand" required minLength={2} maxLength={60} defaultValue={product?.brand} placeholder="Nike, Adidas, New Balance…" /></label>
          <label>Model / artikel<input name="article" required minLength={2} maxLength={120} defaultValue={product?.article} placeholder="Air Force 1 '07" /></label>
          <label>Kategori<select name="category" required defaultValue={product?.category || ""}><option value="" disabled>Pilih kategori</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Kondisi<select name="condition" required defaultValue={product?.condition || ""}><option value="" disabled>Pilih kondisi</option>{Object.entries(conditions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Ukuran (EU)<input name="size" type="number" required min={35} max={50} step={0.5} defaultValue={product?.size} placeholder="42 atau 42.5" /></label>
          <label>Warna<select name="color" required defaultValue={product?.color || ""}><option value="" disabled>Pilih warna</option>{Object.entries(colors).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label className="span-two">Harga (Rp)<input name="price" type="number" required min={1} max={100000000} step={1} defaultValue={product?.price} placeholder="650000" /><small>Harga rupiah, tanpa titik atau koma.</small></label>
          <label className="span-two">Deskripsi<textarea name="description" rows={5} defaultValue={product?.description} placeholder="Kondisi upper dan sol, kekurangan, lama pemakaian, serta kelengkapan…" /></label>
        </div></section>
      </div>
      <aside><section className="tips-panel"><h3>Detail yang perlu difoto.</h3><ul><li>Sepatu dari depan dan samping.</li><li>Sol bagian bawah dan insole.</li><li>Label ukuran dan bekas pemakaian.</li><li>Box atau kelengkapan jika tersedia.</li></ul><div className="tip-note">Alamat dan rencana COD dapat dibicarakan langsung melalui chat.</div></section>
        <div className="form-panel form-submit"><span className="preview-tag">{product ? "EDIT LISTING" : "LISTING BARU"}</span><p>{product ? "Status listing dikelola secara terpisah dari detail produk." : "Listing baru akan tampil di katalog dengan status tersedia."}</p><button type="submit" disabled={reading || pending} className="button dark full">{pending ? "Mengunggah & menyimpan…" : product ? "Simpan perubahan" : "Pasang listing"}<Icon name="arrow" size={18} /></button><Link to="/my-shoes" className="cancel-link">Batal</Link>{pending && <p className="photo-help" role="status">Listing sedang disimpan. Foto baru diunggah jika ada. Tunggu sampai proses selesai.</p>}{notice && <p className="notice" role="status">{notice}</p>}{error && <p className="auth-error" role="alert">{error}</p>}</div>
      </aside>
      </fieldset>
    </form>
  </section>;
}
