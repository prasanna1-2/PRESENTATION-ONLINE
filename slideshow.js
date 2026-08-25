// ============================================================================
// SLIDE SHOW SCREEN
// Upload → Firebase Storage → create room → show host code + slide preview.
// ============================================================================

import { $, formatBytes, kindOf, toast } from "./utils.js";
import { applyIcons } from "./icons.js";
import { uploadPresentationFile, deletePresentationFile } from "./storage.js";
import { createRoom, goLive } from "./room.js";
import { PresentationRenderer } from "./presentation.js";
import { ensureSignedIn } from "./firebase-init.js";

const ACCEPTED = ["pdf", "ppt", "pptx", "jpg", "jpeg", "png", "svg", "gif", "webp", "key", "odp"];

let els = {};
let currentResult = null; // { code, storagePath, renderer }

export function initSlideshow() {
  els = {
    dropzone: $("#dropzone"),
    fileInput: $("#file-input"),
    uploadProgress: $("#upload-progress"),
    uploadFilename: $("#upload-filename"),
    uploadPercent: $("#upload-percent"),
    uploadFill: $("#upload-fill"),
    uploadStatus: $("#upload-status"),
    uploadCard: $("#upload-card"),
    resultCard: $("#result-card"),
    codeBoard: $("#code-board"),
    copyBtn: $("#btn-copy-code"),
    metaName: $("#meta-name"),
    metaFile: $("#meta-file"),
    metaSlides: $("#meta-slides"),
    metaSize: $("#meta-size"),
    officeNotice: $("#office-notice"),
    startBtn: $("#btn-start-presentation"),
    fullscreenBtn: $("#btn-fullscreen-preview"),
    removeBtn: $("#btn-remove-upload"),
    stage: $("#slideshow-stage"),
    slideContainer: $("#slideshow-slide-container"),
  };

  resetUI();

  els.dropzone.addEventListener("click", () => els.fileInput.click());
  els.dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") els.fileInput.click();
  });
  els.dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.dropzone.classList.add("dropzone--drag");
  });
  els.dropzone.addEventListener("dragleave", () => els.dropzone.classList.remove("dropzone--drag"));
  els.dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    els.dropzone.classList.remove("dropzone--drag");
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  });
  els.fileInput.addEventListener("change", () => {
    const file = els.fileInput.files?.[0];
    if (file) handleFile(file);
  });

  els.copyBtn.addEventListener("click", () => {
    if (!currentResult) return;
    navigator.clipboard?.writeText(currentResult.code);
    toast("Host code copied", "success");
  });

  els.startBtn.addEventListener("click", async () => {
    if (!currentResult) return;
    await goLive(currentResult.code);
    window.dispatchEvent(new CustomEvent("relay:navigate", { detail: { screen: "host", params: { code: currentResult.code } } }));
  });

  els.fullscreenBtn.addEventListener("click", () => {
    if (els.stage.requestFullscreen) els.stage.requestFullscreen();
  });

  els.removeBtn.addEventListener("click", async () => {
    if (currentResult?.storagePath) await deletePresentationFile(currentResult.storagePath);
    if (currentResult?.code) {
      const { endRoom } = await import("./room.js");
      await endRoom(currentResult.code);
    }
    resetUI();
    toast("Upload removed", "info");
  });

  applyIcons();
}

function resetUI() {
  currentResult = null;
  els.fileInput.value = "";
  els.uploadProgress.hidden = true;
  els.resultCard.hidden = true;
  els.uploadCard.hidden = false;
  els.uploadFill.style.width = "0%";
}

async function handleFile(file) {
  const ext = kindOf(file.name) === "unknown" ? "" : file.name.split(".").pop().toLowerCase();
  if (!ACCEPTED.includes(ext)) {
    toast("Unsupported file type. Try PDF, PPT/PPTX, JPG, PNG or SVG.", "error");
    return;
  }
  if (file.size > 250 * 1024 * 1024) {
    toast("File is larger than 250 MB — try compressing it first.", "error");
    return;
  }

  els.uploadProgress.hidden = false;
  els.uploadFilename.textContent = file.name;
  els.uploadPercent.textContent = "0%";
  els.uploadFill.style.width = "0%";
  els.uploadStatus.textContent = "Uploading to Firebase Storage…";

  try {
    const user = await ensureSignedIn();

    const { url, path } = await uploadPresentationFile({
      file,
      onProgress: (pct) => {
        els.uploadPercent.textContent = `${pct}%`;
        els.uploadFill.style.width = `${pct}%`;
      },
    });

    els.uploadStatus.textContent = "Reading presentation…";
    const renderer = new PresentationRenderer({ fileURL: url, fileName: file.name });
    const slideCount = await renderer.load();

    els.uploadStatus.textContent = "Creating room…";
    const code = await createRoom({
      hostUid: user.uid,
      name: file.name.replace(/\.[^.]+$/, ""),
      fileName: file.name,
      fileType: file.type || ext,
      fileKind: kindOf(file.name),
      fileURL: url,
      slideCount,
    });

    currentResult = { code, storagePath: path, renderer };
    showResult({ file, code, slideCount, renderer });
    toast("Room created", "success");
  } catch (err) {
    console.error("Upload error:", err.code, err.message, err);
    els.uploadProgress.hidden = false;
    els.uploadStatus.textContent = `Failed: ${err.message || err.code || "Unknown error"}`;
    toast(err.message || "Upload failed", "error");
  }
}

function showResult({ file, code, slideCount, renderer }) {
  els.uploadCard.hidden = true;
  els.resultCard.hidden = false;

  els.codeBoard.innerHTML = "";
  [...code].forEach((ch, i) => {
    const cell = document.createElement("span");
    cell.className = "code-board__cell";
    cell.style.animationDelay = `${i * 45}ms`;
    cell.textContent = ch;
    els.codeBoard.appendChild(cell);
  });

  els.metaName.textContent = file.name.replace(/\.[^.]+$/, "");
  els.metaFile.textContent = file.name.split(".").pop().toUpperCase();
  els.metaSlides.textContent = String(slideCount);
  els.metaSize.textContent = formatBytes(file.size);

  els.officeNotice.hidden = !renderer.needsConversionNotice();

  renderer.renderInto(els.slideContainer, 1);
}
