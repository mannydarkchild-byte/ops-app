const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconFuel() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M4 20V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v14" />
      <path d="M4 20h11" />
      <path d="M15 10h2.5a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3" />
      <path d="M7 8h5" />
    </svg>
  );
}

export function IconAlert() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M12 4 3 19h18L12 4z" />
      <path d="M12 10v4" />
      <path d="M12 16.5h.01" />
    </svg>
  );
}

export function IconInbox() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function IconPlay() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M8 5v14l11-7z" />
    </svg>
  );
}

export function IconStop() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

export function IconClock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...stroke}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </svg>
  );
}

export function IconOut() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" />
      <path d="M15 12H3" />
      <path d="m6 9-3 3 3 3" />
    </svg>
  );
}
