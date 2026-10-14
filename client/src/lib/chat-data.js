export function mergeMessages(previous, incoming) {
  const result = [...previous];
  for (const message of incoming) {
    const index = result.findIndex((item) => (message.id && item.id === message.id)
      || (message.clientMessageId && item.clientMessageId === message.clientMessageId && item.senderId === message.senderId));
    if (index < 0) result.push(message);
    else result[index] = { ...result[index], ...message, readAt: message.readAt || result[index].readAt || null, status: message.id ? "sent" : message.status };
  }
  return result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || (a.id || "").localeCompare(b.id || ""));
}

export function sortChats(chats) {
  return [...chats].sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt));
}

export function dateLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Hari ini";
  if (date.toDateString() === yesterday.toDateString()) return "Kemarin";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function relativeTime(value) {
  if (!value) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value)) / 60000));
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} jam lalu`;
  return dateLabel(value);
}
