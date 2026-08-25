// ============================================================================
// HOST: join-by-code form + the presentation stage itself
// ============================================================================

import { $, normalizeCode, timeAgo, toast } from "./utils.js";
import { applyIcons, setIcon } from "./icons.js";
import { findRoom, watchRoom, watchControllers, pushState, endRoom, clampSlide, goLive } from "./room.js";
import { deletePresentationFile } from "./storage.js";
import { PresentationRenderer } from "./presentation.js";
import { ensureSignedIn } from "./firebase-init.js";

// ---------------------------------------------------------------------- join
export function initHostJoin() {
  const form = $("#host-join-form");
  const input = $("#host-code-input");
  const error = $("#host-join-error");

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
    window.dispatchEvent(new CustomEvent("relay:navigate", { detail: { screen: "host", params: { code } } }));
  };
}

// --------------------------------------------------------------------- stage
let state = null; // { code, renderer, unsubRoom, unsubControllers, currentSlide, room, uid }

export async function initHost(code) {
  teardownHost();
  const els = collectEls();
  const user = await ensureSignedIn();

  const room = await findRoom(code);
  if (!room) {
    toast("That room no longer exists.", "error");
    window.dispatchEvent(new CustomEvent("relay:navigate", { detail: { screen: "host-join" } }));
    return;
  }

  state = {
    code,
    uid: user.uid,
    els,
    renderer: null,
    currentSlide: room.state?.currentSlide || 1,
    isPlaying: !!room.state?.isPlaying,
    slideCount: room.meta.slideCount || 1,
  };

  renderCodeBoard(els.codeBoard, code, "sm");
  els.fileName.textContent = room.meta.fileName || "—";

  // Auto-transition lobby → live the moment a viewer opens the host screen.
  if (room.meta.status === "lobby") goLive(code).catch(() => {});

  state.renderer = new PresentationRenderer({ fileURL: room.meta.fileURL, fileName: room.meta.fileName });
  await state.renderer.load();

  wireControls(els);

  state.unsubRoom = watchRoom(code, (data) => {
    if (!data) {
      toast("Host ended this presentation.", "info");
      window.dispatchEvent(new CustomEvent("relay:navigate", { detail: { screen: "home" } }));
      return;
    }
    state.slideCount = data.meta.slideCount || 1;
    els.counter.textContent = `${state.currentSlide} / ${state.slideCount}`;
    const s = data.state || {};
    if (s.currentSlide && s.currentSlide !== state.currentSlide) {
      state.currentSlide = s.currentSlide;
      renderSlide();
    }
    state.isPlaying = !!s.isPlaying;
    setIcon(els.playpause, state.isPlaying ? "pause" : "play");
    els.statusPill.classList.toggle("pill--live", data.meta.status === "live");
  });

  state.unsubControllers = watchControllers(code, (controllers) => {
    const entries = Object.entries(controllers || {});
    els.controllerCount.textContent = String(entries.length);
    els.controllerList.innerHTML = "";
    if (!entries.length) {
      els.controllerList.innerHTML = `<li class="controller-list__empty">No phones connected yet.</li>`;
      return;
    }
    for (const [uid, c] of entries) {
      const li = document.createElement("li");
      li.className = "controller-item";
      li.innerHTML = `<span class="controller-item__dot"></span>
        <span class="controller-item__label">${c.label || "Mobile controller"}</span>
        <span class="controller-item__time">${timeAgo(c.lastSeen)}</span>`;
      els.controllerList.appendChild(li);
    }
  });

  renderSlide();
  applyIcons();
}

export function teardownHost() {
  state?.unsubRoom?.();
  state?.unsubControllers?.();
  document.removeEventListener("keydown", handleKeys);
  if (state?.els?.stage && document.fullscreenElement === state.els.stage) document.exitFullscreen?.();
  state = null;
}

function collectEls() {
  return {
    stage: $("#host-stage"),
    slideContainer: $("#host-slide-container"),
    counter: $("#host-slide-counter"),
    statusPill: $("#host-status-pill"),
    codeBoard: $("#host-code-board"),
    fileName: $("#host-file-name"),
    controllerCount: $("#controller-count"),
    controllerList: $("#controller-list"),
    endBtn: $("#btn-end-room"),
    first: $("#host-first"),
    prev: $("#host-prev"),
    next: $("#host-next"),
    last: $("#host-last"),
    playpause: $("#host-playpause"),
    fullscreen: $("#host-fullscreen"),
  };
}

function wireControls(els) {
  els.first.onclick = () => goToSlide(1);
  els.last.onclick = () => goToSlide(state.slideCount);
  els.prev.onclick = () => goToSlide(state.currentSlide - 1);
  els.next.onclick = () => goToSlide(state.currentSlide + 1);
  els.playpause.onclick = () => {
    state.isPlaying = !state.isPlaying;
    setIcon(els.playpause, state.isPlaying ? "pause" : "play");
    pushState(state.code, { isPlaying: state.isPlaying });
  };
  els.fullscreen.onclick = () => els.stage.requestFullscreen?.();
  els.endBtn.onclick = async () => {
    if (!confirm("End this presentation and delete the room? Connected phones will be disconnected.")) return;
    try {
      await endRoom(state.code);
      toast("Room ended", "info");
      window.dispatchEvent(new CustomEvent("relay:navigate", { detail: { screen: "home" } }));
    } catch (err) {
      toast("Only the presentation owner can end this room.", "error");
    }
  };

  document.addEventListener("keydown", handleKeys);
}

function handleKeys(e) {
  if (!state || !document.getElementById("screen-host")?.classList.contains("screen--active")) return;
  if (e.key === "ArrowRight") goToSlide(state.currentSlide + 1);
  if (e.key === "ArrowLeft") goToSlide(state.currentSlide - 1);
}

function goToSlide(n) {
  const clamped = clampSlide(n, state.slideCount);
  if (clamped === state.currentSlide) return;
  state.currentSlide = clamped;
  renderSlide();
  pushState(state.code, { currentSlide: clamped });
}

function renderSlide() {
  if (!state?.renderer) return;
  state.els.counter.textContent = `${state.currentSlide} / ${state.slideCount}`;
  state.renderer.renderInto(state.els.slideContainer, state.currentSlide);
}

export function renderCodeBoard(boardEl, code, size = "") {
  boardEl.innerHTML = "";
  boardEl.classList.toggle("code-board--sm", size === "sm");
  [...code].forEach((ch, i) => {
    const cell = document.createElement("span");
    cell.className = "code-board__cell";
    cell.style.animationDelay = `${i * 40}ms`;
    cell.textContent = ch;
    boardEl.appendChild(cell);
  });
}
