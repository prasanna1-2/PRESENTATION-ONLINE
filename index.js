/**
 * OPTIONAL — server-side PPT/PPTX conversion.
 *
 * The main app works fully without this: PDFs and images render natively in
 * the browser, and PPT/PPTX files still upload, store, and sync a room, just
 * as a single placeholder slide (see js/presentation.js). This function is
 * the "appropriate conversion/backend service" the brief calls for if you
 * want real slide-by-slide sync for PPT/PPTX too.
 *
 * Pattern: Storage upload trigger -> call a conversion API (CloudConvert,
 * Aspose, or a self-hosted LibreOffice `soffice --headless --convert-to pdf`
 * container) -> upload each resulting slide image back to Storage -> patch
 * /rooms/{code}/meta with the real slideCount and an ordered image list.
 *
 * Deploy-time secret handling: the conversion API key is set with
 *   firebase functions:config:set cloudconvert.key="..."
 * and read via functions.config() below — it never touches the client.
 *
 * This file is illustrative scaffolding, not a turnkey deploy: wire in your
 * chosen conversion provider's SDK/HTTP calls where marked.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.database();

exports.onPresentationUploaded = functions.storage.object().onFinalize(async (object) => {
  const filePath = object.name || "";
  const match = filePath.match(/^presentations\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) return null;

  const [, hostUid, code] = match;
  const isOffice = /\.(pptx?|key|odp)$/i.test(filePath);
  if (!isOffice) return null; // PDFs/images already work client-side.

  const roomSnap = await db.ref(`rooms/${code}/meta`).get();
  if (!roomSnap.exists() || roomSnap.val().hostUid !== hostUid) return null;

  try {
    // ------------------------------------------------------------------
    // TODO: call your conversion provider here, e.g.:
    //   const apiKey = functions.config().cloudconvert.key;
    //   const slideImageUrls = await convertToSlideImages(object, apiKey);
    // Each returned URL should be uploaded into the same
    // presentations/{hostUid}/{code}/ folder so storage.rules already
    // covers it, then written back below.
    // ------------------------------------------------------------------
    const slideImageUrls = []; // placeholder — populate from your provider

    if (slideImageUrls.length) {
      await db.ref(`rooms/${code}/meta`).update({
        fileKind: "converted",
        slideCount: slideImageUrls.length,
        slideImages: slideImageUrls,
      });
    }
  } catch (err) {
    console.error(`Conversion failed for room ${code}:`, err);
  }
  return null;
});
