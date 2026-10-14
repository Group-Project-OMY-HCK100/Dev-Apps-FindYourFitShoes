import { useEffect, useRef } from "react";

export default function ConfirmDialog({ title, description, onCancel, onConfirm }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="confirm-dialog" onCancel={onCancel} aria-labelledby="confirm-title"><h2 id="confirm-title">{title}</h2><p>{description}</p><div><button autoFocus className="button outline" onClick={onCancel}>Batal</button><button className="button dark" onClick={onConfirm}>Preview hapus</button></div></dialog>;
}
