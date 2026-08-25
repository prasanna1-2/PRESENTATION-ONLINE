// ============================================================================
// RELAY — app entry point / router
// ============================================================================

import { $, $all } from "./utils.js";
import { applyIcons } from "./icons.js";
import { authReady, ensureSignedIn, onAuthStateChanged, auth } from "./firebase-init.js";
import { initSlideshow } from "./slideshow.js";
import { initHostJoin, initHost, teardownHost } from "./host.js";
import { initRemoteJoin, initRemote, teardownRemote } from "./remote.js";

const SCREENS = {
  home: { init: () => {} },
  slideshow: { init: () => initSlideshow(), once: true },
  "host-join": { init: () => initHostJoin() },
  host: { init: (p) => initHost(p.code), teardown: () => teardownHost() },
  "remote-join": { init: () => initRemoteJoin() },
  remote: { init: (p) => initRemote(p.code), teardown: () => teardownRemote() },
};

let current = null;
const initedOnce = new Set();

function navigate(screen, params = {}) {
  if (!SCREENS[screen]) screen = "home";

  if (current && current !== screen && SCREENS[current]?.teardown) {
    SCREENS[current].teardown();
  }

  $all(".screen").forEach((el) => el.classList.remove("screen--active"));
  const target = document.getElementById(`screen-${screen}`);
  target?.classList.add("screen--active");
  window.scrollTo({ top: 0, behavior: "smooth" });

  const def = SCREENS[screen];
  if (def && !(def.once && initedOnce.has(screen))) {
    def.init(params);
    if (def.once) initedOnce.add(screen);
  }
  current = screen;
  applyIcons();
}

// nav buttons anywhere in the document
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-nav]");
  if (!btn) return;
  navigate(btn.dataset.nav);
});

// modules dispatch this when they need to move the user programmatically
window.addEventListener("relay:navigate", (e) => {
  navigate(e.detail.screen, e.detail.params || {});
});

async function boot() {
  applyIcons();
  onAuthStateChanged(auth, (user) => {
    const pill = $("#auth-pill");
    const label = $("#auth-pill-label");
    if (user) {
      pill.classList.add("auth-pill--ready");
      label.textContent = "Connected";
    } else {
      pill.classList.remove("auth-pill--ready");
      label.textContent = "Connecting…";
    }
  });
  try {
    await ensureSignedIn();
  } catch (err) {
    console.error("Firebase sign-in failed:", err);
  }
  await authReady;
  navigate("home");
}

boot();
