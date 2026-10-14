import { useEffect, useRef } from "react";

export default function ConfirmDialog({ title, description, onCancel, onConfirm, pending = false, error = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog ref={ref} className="confirm-dialog" aria-labelledby="confirm-title" aria-describedby="confirm-description" aria-busy={pending} onCancel={(event) => {
      event.preventDefault();
      if (!pending) onCancel();
    }}>
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-description">{description}</p>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {pending && <p role="status">Menghapus listing…</p>}
      <div>
        <button autoFocus disabled={pending} className="button outline" onClick={onCancel}>Batal</button>
        <button disabled={pending} className="button dark" onClick={onConfirm}>{pending ? "Menghapus…" : "Hapus listing"}</button>
      </div>
    </dialog>
  );
}
