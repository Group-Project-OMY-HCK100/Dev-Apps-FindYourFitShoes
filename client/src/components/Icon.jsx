export default function Icon({ name, size = 20, ...props }) {
  const paths = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    chat: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5" /></>,
    location: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    shoe: <><path d="m3 7 5 2 3-5 3 7 6 3a3 3 0 0 1 1 5H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" /><path d="M2 16h18M10 10l3-1m-1 4 3-1" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.arrow}</svg>;
}
