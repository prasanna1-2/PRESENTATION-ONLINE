// ============================================================================
// SHARED UTILITIES
// ============================================================================

// Characters chosen to avoid easily-confused pairs (0/O, 1/I, etc.)
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Generates a room / host code like "DAKU7284". */
export function generateHostCode(length = 8) {
  let code = "";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export function normalizeCode(code) {
  return (code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function extOf(filename) {
  const m = /\.([a-z0-9]+)$/i.exec(filename || "");
  return m ? m[1].toLowerCase() : "";
}

export const FILE_KIND = {
  pdf: "pdf",
  jpg: "image",
  jpeg: "image",
  png: "image",
  svg: "image",
  gif: "image",
  webp: "image",
  ppt: "office",
  pptx: "office",
  key: "office",
  odp: "office",
};

export function kindOf(filename) {
  return FILE_KIND[extOf(filename)] || "unknown";
}

/** Minimal toast notification system. Call toast('Saved', 'success'). */
export function toast(message, variant = "info", timeout = 3800) {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `toast toast--${variant}`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast--in"));
  setTimeout(() => {
    el.classList.remove("toast--in");
    setTimeout(() => el.remove(), 300);
  }, timeout);
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}
export function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Relative "just now / 5s ago" label for lastSeen timestamps. */
export function timeAgo(ts) {
  if (!ts) return "—";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 3) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
