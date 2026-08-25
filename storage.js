// ============================================================================
// IMGBB STORAGE — replaces Firebase Storage
// Supports: JPG, JPEG, PNG, SVG, GIF, WEBP, PDF (as image)
// Replace IMGBB_API_KEY with your own key from imgbb.com
// ============================================================================

const IMGBB_API_KEY = "f0bfd190fa35268ec184f6c5a9ddd89e";

export async function uploadPresentationFile({ file, onProgress }) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 40));
    };

    reader.onload = async () => {
      try {
        onProgress?.(50);
        const base64 = reader.result.split(",")[1];

        const formData = new FormData();
        formData.append("key", IMGBB_API_KEY);
        formData.append("image", base64);
        formData.append("name", file.name.replace(/\.[^.]+$/, ""));

        onProgress?.(65);

        const res = await fetch("https://api.imgbb.com/1/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!data.success) throw new Error(data.error?.message || "ImgBB upload failed");

        onProgress?.(100);
        resolve({ url: data.data.url, path: data.data.id });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function deletePresentationFile(path) {
  // ImgBB free tier doesn't support deletion via API — images stay hosted
  console.log("ImgBB: hosted image retained (deletion requires paid plan):", path);
}
