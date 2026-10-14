import baseUrl from "./baseUrl";

export default (import.meta.env.VITE_SOCKET_URL || baseUrl).replace(/\/$/, "");
