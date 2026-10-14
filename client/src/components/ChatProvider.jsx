import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import baseUrl from "../constants/baseUrl";
import socketUrl from "../constants/socketUrl";
import { ChatContext } from "../lib/chat-context";
import { sortChats } from "../lib/chat-data";

export default function ChatProvider({ token, onUnauthorized, children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [chats, setChats] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [inboxState, setInboxState] = useState("loading");
  const [error, setError] = useState("");
  const alive = useRef(false);
  const revision = useRef(0);
  const fetchSequence = useRef(0);

  const request = useCallback(async (path, options = {}) => {
    try {
      const { data } = await axios({ url: `${baseUrl}${path}`, headers: { Authorization: `Bearer ${token}` }, timeout: 15000, ...options });
      return data;
    } catch (problem) {
      if (problem.response?.status === 401 && alive.current) onUnauthorized();
      throw problem;
    }
  }, [token, onUnauthorized]);

  const refreshInbox = useCallback(async function refresh() {
    if (!token) return;
    const sequence = ++fetchSequence.current;
    const version = revision.current;
    try {
      const rows = [];
      let page = 1;
      let pages;
      do {
        const result = await request(`/chats?page=${page}&limit=50`);
        rows.push(...result.data);
        pages = result.meta.totalPages;
        page += 1;
      } while (page <= pages && alive.current);
      if (!alive.current || sequence !== fetchSequence.current) return;
      if (version !== revision.current) { void refresh(); return; }
      setChats(sortChats(rows));
      setTotalUnread(rows.reduce((sum, item) => sum + item.unreadCount, 0));
      setInboxState("content");
      setError("");
    } catch (problem) {
      if (!alive.current || sequence !== fetchSequence.current) return;
      setInboxState("error");
      setError(problem.response?.data?.error?.message || "Inbox belum bisa dimuat.");
    }
  }, [token, request]);

  const emit = useCallback((name, payload = {}) => new Promise((resolve, reject) => {
    if (!socket?.connected) { reject(new Error("Koneksi terputus. Coba kirim ulang setelah tersambung.")); return; }
    socket.timeout(5000).emit(name, payload, (problem, response) => {
      if (problem) { reject(new Error("Server belum mengonfirmasi. Kamu bisa kirim ulang pesan ini.")); return; }
      if (!response?.success) {
        const failure = Object.assign(new Error(response?.error?.message || "Permintaan gagal."), response?.error);
        if (["UNAUTHORIZED", "TOKEN_EXPIRED"].includes(failure.code) && alive.current) onUnauthorized();
        reject(failure);
      } else resolve(response.data);
    });
  }), [socket, onUnauthorized]);

  useEffect(() => {
    alive.current = true;
    if (!token) return () => { alive.current = false; };
    const client = io(socketUrl, { auth: { token }, autoConnect: false });
    const onConnect = () => { setConnected(true); void refreshInbox(); };
    const onDisconnect = (reason) => {
      setConnected(false);
      if (reason === "io server disconnect") onUnauthorized();
    };
    const onError = (problem) => {
      setConnected(false);
      if (problem.data?.code === "UNAUTHORIZED") onUnauthorized();
    };
    const onCreated = (chat) => {
      revision.current += 1;
      setChats((previous) => sortChats([chat, ...previous.filter((item) => item.id !== chat.id)]));
      void refreshInbox();
    };
    const onNotification = ({ chatId, message, unreadCount }) => {
      revision.current += 1;
      setChats((previous) => sortChats(previous.map((item) => item.id === chatId ? { ...item, lastMessage: message, lastMessageAt: message.createdAt, unreadCount } : item)));
      void refreshInbox();
    };
    const onMessage = (message) => {
      revision.current += 1;
      setChats((previous) => sortChats(previous.map((item) => item.id === message.chatId ? { ...item, lastMessage: message, lastMessageAt: message.createdAt } : item)));
    };
    const onUnread = ({ totalUnread: total, chatId, unreadCount }) => {
      revision.current += 1;
      setTotalUnread(total);
      setChats((previous) => previous.map((item) => item.id === chatId ? { ...item, unreadCount } : item));
    };
    const onListing = ({ shoeId, status, deletedAt }) => {
      revision.current += 1;
      setChats((previous) => previous.map((item) => item.shoe.id === shoeId ? { ...item, shoe: { ...item.shoe, ...(status ? { status } : {}), ...(deletedAt ? { isDeleted: true } : {}) } } : item));
    };
    const listeners = { connect: onConnect, disconnect: onDisconnect, connect_error: onError, "chat:created": onCreated, "notification:new": onNotification, "message:new": onMessage, "unread:update": onUnread, "listing:status": onListing, "listing:deleted": onListing };
    Object.entries(listeners).forEach(([name, handler]) => client.on(name, handler));
    // StrictMode cancels its first setup before this connection starts.
    const timer = setTimeout(() => { setSocket(client); client.connect(); void refreshInbox(); }, 0);
    return () => {
      alive.current = false;
      clearTimeout(timer);
      Object.entries(listeners).forEach(([name, handler]) => client.off(name, handler));
      client.disconnect();
    };
  }, [token, onUnauthorized, refreshInbox]);

  return <ChatContext.Provider value={{ socket, connected, chats, totalUnread, inboxState, error, request, emit, refreshInbox }}>{children}</ChatContext.Provider>;
}
