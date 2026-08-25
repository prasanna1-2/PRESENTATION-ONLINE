// ============================================================================
// MOBILE REMOTE: join-by-code form + the wireless clicker
// ============================================================================

import { $, normalizeCode, toast } from "./utils.js";
import { applyIcons, setIcon } from "./icons.js";
import { findRoom, watchRoom, watchConnection, joinAsController, heartbeat, pushState, clampSlide } from "./room.js";
import { PresentationRenderer } from "./presentation.js";
import { ensureSignedIn } from "./firebase-init.js";

export function initRemoteJoin() {
  const form = $("#remote-join-form");
  const input = $("#remote-code-input");
  const error = $("#remote-join-error");

  form.onsubmit = async (e) => {
    e.preventDefault();
    error.hidden = true;
    const code = normalizeCode(input.value);
    if (!code) return;
    const room = await findRoom(code);
    if (!room) {
      error.textContent = "No active presentation with that code. Double-check and try again.";
      error.hidden = false;
      return;
    }
    window.dispatchEvent(new CustomEvent("relay:navigate", { detail: { screen: "remote", params: { code } } }));
  };
}

let state = null; // { code, uid, els, renderer, currentSlide, slideCount, isPlaying, unsubRoom, unsubLeave, heartbeatId }

export async function initRemote(code) {
  teardownRemote();
  const els = collectEls();
  const user = await ensureSignedIn();

  const room = await findRoom(code);
  if (!room) {
    toast("That room no longer exists.", "error");
    window.dispatchEvent(new CustomEvent("relay:navigate", { detail: { screen: "remote-join" } }));
    return;
  }

  state = {
    code,
    uid: user.uid,
    els,
    renderer: null,
    currentSlide: room.state?.currentSlide || 1,
    slideCount: room.meta.slideCount || 1,
    isPlaying: !!room.state?.isPlaying,
  };

  els.codeChip.textContent = code;
  els.fileName.textContent = room.meta.fileName || "—";

  state.unsubLeave = await joinAsController(code, user.uid, deviceLabel());
  state.heartbeatId = setInterval(() => heartbeat(code, user.uid), 15000);

  state.renderer = new PresentationRenderer({ fileURL: room.meta.fileURL, fileName: room.meta.fileName });
  await state.renderer.load();

  wireControls(els);
  setConnected(true);

  state.unsubRoom = watchRoom(code, (data) => {
    if (!data) {
      setConnected(false);
      toast("The host ended this presentation.", "info");
      cleanupAndGoHome();
      return;
    }
    state.slideCount = data.meta.slideCount || 1;
    const s = data.state || {};
    if (s.currentSlide && s.currentSlide !== state.currentSlide) {
      state.currentSlide = s.currentSlide;
      renderPreview();
    }
    state.isPlaying = !!s.isPlaying;
    updatePlayPause();
    updateCounter();
  });

  state.unsubConn = watchConnection(setConnected);

  renderPreview();
  updateCounter();
  applyIcons();
  updatePlayPause();
}

export function teardownRemote() {
  clearInterval(state?.heartbeatId);
  state?.unsubRoom?.();
  state?.unsubConn?.();
  state?.unsubLeave?.();
  state = null;
}

function collectEls() {
  return {
    statusPill: $("#remote-status-pill"),
    codeChip: $("#remote-code-chip"),
    fileName: $("#remote-file-name"),
    preview: $("#remote-preview"),
    current: $("#remote-current"),
    total: $("#remote-total"),
    first: $("#remote-first"),
    last: $("#remote-last"),
    prev: $("#remote-prev"),
    next: $("#remote-next"),
    playpause: $("#remote-playpause"),
    playpauseIcon: $("#remote-playpause span"),
    fullscreen: $("#remote-fullscreen"),
    disconnect: $("#btn-disconnect"),
  };
}

function wireControls(els) {
  els.first.onclick = () => go(1);
  els.last.onclick = () => go(state.slideCount);
  els.prev.onclick = () => go(state.currentSlide - 1);
  els.next.onclick = () => go(state.currentSlide + 1);
  els.playpause.onclick = () => {
    state.isPlaying = !state.isPlaying;
    updatePlayPause();
    pushState(state.code, { isPlaying: state.isPlaying });
  };
  // Fullscreens the phone's own preview panel — the big screen's fullscreen
  // must be triggered on that device directly (browsers require a real
  // user gesture on the element being fullscreened, so it can't be forced
  // remotely over Firebase).
  els.fullscreen.onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else els.preview.requestFullscreen?.();
  };
  els.disconnect.onclick = () => {
    cleanupAndGoHome();
  };

  // swipe gestures feel natural on a clicker
  let touchX = null;
  els.preview.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX));
  els.preview.addEventListener("touchend", (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) dx < 0 ? go(state.currentSlide + 1) : go(state.currentSlide - 1);
    touchX = null;
  });
}

function go(n) {
  const clamped = clampSlide(n, state.slideCount);
  if (clamped === state.currentSlide) return;
  state.currentSlide = clamped;
  renderPreview();
  updateCounter();
  pushState(state.code, { currentSlide: clamped });
}

function renderPreview() {
  if (!state?.renderer) return;
  state.renderer.renderInto(state.els.preview, state.currentSlide);
}

function updatePlayPause() {
  const els = state.els;
  setIcon(els.playpauseIcon, state.isPlaying ? "pause" : "play");
  els.playpause.lastChild.textContent = state.isPlaying ? "Pause" : "Play";
}

function updateCounter() {
  state.els.current.textContent = String(state.currentSlide);
  state.els.total.textContent = String(state.slideCount);
}

function setConnected(ok) {
  if (!state) return;
  state.els.statusPill.classList.toggle("pill--live", ok);
  state.els.statusPill.lastChild.textContent = ok ? " Connected" : " Reconnecting…";
}

function cleanupAndGoHome() {
  teardownRemote();
  window.dispatchEvent(new CustomEvent("relay:navigate", { detail: { screen: "home" } }));
}

function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";
  if (/android/i.test(ua)) return "Android phone";
  return "Mobile controller";
}
