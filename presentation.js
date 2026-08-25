// ============================================================================
// PRESENTATION RENDERER
// ============================================================================
// Browsers can only natively decode what they can natively decode: PDFs
// (via pdf.js) and raster/vector images. PPT/PPTX/KEY/ODP are proprietary
// zip/binary formats with no browser-native renderer, so — per the brief —
// this app does NOT pretend to paginate them client-side. Instead:
//   - The file is still uploaded, stored, and shareable.
//   - The room is created with a single placeholder "slide" pointing at the
//     original file, so Host/Remote/sync all still work end-to-end.
//   - The UI tells the presenter to export to PDF for real slide-by-slide
//     control, or wire up the optional conversion Cloud Function described
//     in README.md (e.g. calling CloudConvert/Gotenna/LibreOffice headless
//     server-side, which turns each slide into an image and writes the
//     resulting slideCount + image URLs back into /rooms/{code}/meta).
// ============================================================================

import { kindOf } from "./utils.js";

// jsDelivr mirrors the npm package's files directly, so these paths track
// the real "pdfjs-dist" release layout (build/pdf.mjs + build/pdf.worker.mjs)
// rather than a CDN-specific repackaging. If this version ever gets pulled,
// bump PDFJS_VERSION to whatever's current on https://www.npmjs.com/package/pdfjs-dist.
const PDFJS_VERSION = "4.0.379";
let pdfjsLibPromise = null;

function loadPdfJs() {
  if (pdfjsLibPromise) return pdfjsLibPromise;
  pdfjsLibPromise = import(`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`).then((mod) => {
    mod.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
    return mod;
  });
  return pdfjsLibPromise;
}

export class PresentationRenderer {
  constructor({ fileURL, fileName }) {
    this.fileURL = fileURL;
    this.fileName = fileName;
    this.kind = kindOf(fileName);
    this.pdfDoc = null;
    this.slideCount = 1;
  }

  /** Must be called before rendering. Resolves the true slide count. */
  async load() {
    if (this.kind === "pdf") {
      const pdfjsLib = await loadPdfJs();
      this.pdfDoc = await pdfjsLib.getDocument(this.fileURL).promise;
      this.slideCount = this.pdfDoc.numPages;
    } else {
      // image + office fallback are both single "slides"
      this.slideCount = 1;
    }
    return this.slideCount;
  }

  needsConversionNotice() {
    return this.kind === "office";
  }

  /** Renders slide `n` (1-indexed) into the given container element. */
  async renderInto(container, n) {
    container.innerHTML = "";
    if (this.kind === "pdf") {
      await this._renderPdfPage(container, n);
    } else if (this.kind === "image") {
      const img = document.createElement("img");
      img.className = "slide-image";
      img.src = this.fileURL;
      img.alt = this.fileName;
      container.appendChild(img);
    } else {
      container.appendChild(this._renderOfficeFallback());
    }
  }

  async _renderPdfPage(container, n) {
    const page = await this.pdfDoc.getPage(Math.min(Math.max(1, n), this.slideCount));
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(container.clientWidth / baseViewport.width, container.clientHeight / baseViewport.height) || 1;
    const viewport = page.getViewport({ scale: Math.max(scale, 0.1) * (window.devicePixelRatio || 1) });

    const canvas = document.createElement("canvas");
    canvas.className = "slide-canvas";
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / (window.devicePixelRatio || 1)}px`;
    canvas.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`;
    container.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
  }

  _renderOfficeFallback() {
    const wrap = document.createElement("div");
    wrap.className = "office-fallback";
    wrap.innerHTML = `
      <div class="office-fallback__icon">📄</div>
      <div class="office-fallback__name">${escapeHtml(this.fileName)}</div>
      <p class="office-fallback__note">
        This file format can't be paginated in the browser without a conversion
        step. It's stored and shareable, and slide sync still works as a single
        screen — export to PDF before uploading for full slide-by-slide control,
        or connect the optional conversion function described in the README.
      </p>
      <a class="btn btn--ghost btn--sm" href="${this.fileURL}" target="_blank" rel="noopener">Open original file</a>
    `;
    return wrap;
  }
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
