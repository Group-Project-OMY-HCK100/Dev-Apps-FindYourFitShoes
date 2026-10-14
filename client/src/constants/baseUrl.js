const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
export default baseUrl.replace(/\/$/, "");
