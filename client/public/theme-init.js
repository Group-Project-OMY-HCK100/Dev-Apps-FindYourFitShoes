// Apply the saved theme before React loads to avoid a light flash on refresh.
try {
  document.documentElement.dataset.theme = localStorage.getItem("soleswap.theme") === "dark" ? "dark" : "light";
} catch {
  document.documentElement.dataset.theme = "light";
}
