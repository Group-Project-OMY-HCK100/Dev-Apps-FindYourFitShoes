import { products, previewUser } from "./products";
const buyer = { id: "10000000-0000-4000-8000-000000000003", name: "Nadia Putri" };
export const chats = products.map((shoe, index) => {
  const own = shoe.seller.id === previewUser.id;
  const otherParticipant = own ? buyer : shoe.seller;
  const chatId = `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
  return {
    id: chatId, shoe: { ...shoe, isDeleted: false }, buyer: own ? buyer : previewUser,
    seller: shoe.seller, otherParticipant, unreadCount: index === 0 ? 2 : 0,
    messages: [
      { id: `${chatId}-1`, senderId: own ? buyer.id : previewUser.id, text: "Halo, boleh minta foto detail bagian sol dan insole-nya?", time: "10.28" },
      { id: `${chatId}-2`, senderId: shoe.seller.id, text: "Boleh. Sol masih layak, ada sedikit bekas pemakaian. Nanti aku kirim foto detailnya ya.", time: "10.30" },
      { id: `${chatId}-3`, senderId: own ? buyer.id : previewUser.id, text: "Siap, terima kasih. Kalau cocok boleh kita diskusikan harga dan lokasi COD?", time: "10.32" },
    ],
  };
});
chats.push({ ...chats[3], id: "40000000-0000-4000-8000-000000000007", shoe: { ...products[3], article: "Arsip listing lama", isDeleted: true }, unreadCount: 0 });
