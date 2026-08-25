// ============================================================================
// ICONS — inline SVG, applied to any element carrying data-icon="name"
// ============================================================================

const ICONS = {
  upload: `<path d="M12 3v12" stroke-linecap="round"/><path d="M7 8l5-5 5 5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke-linecap="round" stroke-linejoin="round"/>`,
  host: `<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4" stroke-linecap="round"/>`,
  remote: `<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 6h2" stroke-linecap="round"/><circle cx="12" cy="14" r="2.2"/>`,
  play: `<path d="M8 5.5v13l11-6.5-11-6.5z"/>`,
  pause: `<path d="M8 5h3v14H8zM13 5h3v14h-3z"/>`,
  next: `<path d="M6 5l10 7-10 7V5z"/><path d="M18 5v14" stroke-linecap="round"/>`,
  prev: `<path d="M18 5L8 12l10 7V5z"/><path d="M6 5v14" stroke-linecap="round"/>`,
  first: `<path d="M17 5L7 12l10 7V5z"/><path d="M5 5v14" stroke-linecap="round"/>`,
  last: `<path d="M7 5l10 7-10 7V5z"/><path d="M19 5v14" stroke-linecap="round"/>`,
  fullscreen: `<path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4" stroke-linecap="round" stroke-linejoin="round"/>`,
  disconnect: `<path d="M18.36 6.64a9 9 0 1 1-12.73 0" stroke-linecap="round"/><path d="M12 2v9" stroke-linecap="round"/><path d="M4 4l16 16" stroke-linecap="round"/>`,
  check: `<path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>`,
  x: `<path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/>`,
  phone: `<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 6h2" stroke-linecap="round"/>`,
};

export function applyIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    const name = el.getAttribute("data-icon");
    if (!ICONS[name] || el.dataset.iconApplied === name) return;
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${ICONS[name]}</svg>`;
    el.dataset.iconApplied = name;
  });
}

export function setIcon(el, name) {
  if (!el || !ICONS[name]) return;
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${ICONS[name]}</svg>`;
  el.dataset.iconApplied = name;
}
