// ============================================================================
// ROOM SYSTEM
// Wraps every Realtime Database read/write that touches a presentation
// "room" (/rooms/{code}). This is the single source of truth for the
// schema so the security rules and the client never drift apart:
//
// /rooms/{code}
//     hostUid, name, fileName, fileType, fileKind, fileURL,
//     slideCount, createdAt, status: "lobby" | "live" | "ended"
//   /state
//     currentSlide, isPlaying, fullscreen, updatedAt
//   /controllers/{uid}
//     joinedAt, lastSeen, label
// ============================================================================

import { db, ref, set, update, get, remove, onValue, onDisconnect, serverTimestamp } from "./firebase-init.js";
import { generateHostCode, normalizeCode } from "./utils.js";

/** Creates a brand-new room for a freshly-uploaded presentation. */
export async function createRoom({ hostUid, name, fileName, fileType, fileKind, fileURL, slideCount }) {
  // Guard against the (astronomically unlikely) code collision.
  let code = generateHostCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const snap = await get(ref(db, `rooms/${code}/meta/status`));
    if (!snap.exists()) break;
    code = generateHostCode();
  }

  const roomRef = ref(db, `rooms/${code}`);
  await set(roomRef, {
    meta: {
      hostUid,
      name,
      fileName,
      fileType,
      fileKind,
      fileURL,
      slideCount,
      createdAt: serverTimestamp(),
      status: "lobby",
    },
    state: {
      currentSlide: 1,
      isPlaying: false,
      fullscreen: false,
      updatedAt: serverTimestamp(),
    },
  });

  return code;
}

/** Looks up a room by code. Returns null if it doesn't exist or has ended. */
export async function findRoom(rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const snap = await get(ref(db, `rooms/${code}`));
  if (!snap.exists()) return null;
  const data = snap.val();
  if (data?.meta?.status === "ended") return null;
  return { code, ...data };
}

/** Host: marks the room live once they hit "Start Presentation". */
export function goLive(code) {
  return update(ref(db, `rooms/${code}/meta`), { status: "live" });
}

/** Host: ends and deletes the room outright (frees the code + storage record). */
export async function endRoom(code) {
  await remove(ref(db, `rooms/${code}`));
}

/** Subscribes to the whole room; calls cb(roomDataOrNull) on every change. */
export function watchRoom(code, cb) {
  const roomRef = ref(db, `rooms/${code}`);
  return onValue(roomRef, (snap) => {
    if (!snap.exists() || snap.val()?.meta?.status === "ended") {
      cb(null);
      return;
    }
    cb(snap.val());
  });
}

/**
 * Firebase's special ".info/connected" path reflects this client's live
 * socket state and flips automatically as the network drops/recovers —
 * the SDK itself handles reconnecting and replaying listeners, so the UI
 * just needs to mirror this flag rather than implement retry logic.
 */
export function watchConnection(cb) {
  return onValue(ref(db, ".info/connected"), (snap) => cb(!!snap.val()));
}

/** Subscribes to just the fast-changing playback state. */
export function watchState(code, cb) {
  const stateRef = ref(db, `rooms/${code}/state`);
  return onValue(stateRef, (snap) => cb(snap.val() || {}));
}

/** Subscribes to the connected-controllers list (for the host's UI). */
export function watchControllers(code, cb) {
  const controllersRef = ref(db, `rooms/${code}/controllers`);
  return onValue(controllersRef, (snap) => cb(snap.val() || {}));
}

/** Mobile remote: joins the room as a controller with automatic presence cleanup. */
export async function joinAsController(code, uid, label) {
  const controllerRef = ref(db, `rooms/${code}/controllers/${uid}`);
  await set(controllerRef, {
    joinedAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
    label: label || "Mobile controller",
  });
  // If the phone loses signal / closes the tab, Firebase removes this node
  // itself — that's how the host's "connected controllers" list stays live.
  onDisconnect(controllerRef).remove();
  return () => remove(controllerRef);
}

export function heartbeat(code, uid) {
  return update(ref(db, `rooms/${code}/controllers/${uid}`), { lastSeen: serverTimestamp() });
}

/** Either host or a joined controller may push a new playback state. */
export function pushState(code, patch) {
  return update(ref(db, `rooms/${code}/state`), { ...patch, updatedAt: serverTimestamp() });
}

export function clampSlide(n, slideCount) {
  return Math.min(Math.max(1, n), Math.max(1, slideCount || 1));
}
