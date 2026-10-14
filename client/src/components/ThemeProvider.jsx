import { useEffect, useState } from "react";
import { ThemeContext } from "../lib/theme-context";

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("soleswap.theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("soleswap.theme", theme);
    } catch {
      // Tema tetap bisa diganti ketika penyimpanan browser tidak tersedia.
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => current === "light" ? "dark" : "light");
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
