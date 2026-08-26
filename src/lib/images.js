// Downscales and re-encodes an image file client-side before it ever
// reaches Storage — a phone photo (often 3-12MB) becomes a ~100-400KB JPEG,
// which is what keeps per-entry photo uploads cheap at this app's scale
// (see the Storage cost conversation this was built from).
export function compressImage(file, { maxDim = 1600, quality = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) { reject(new Error("Couldn't process that image — try a different file.")); return; }
          resolve(blob);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Couldn't read that image — try a different file."));
    };
    img.src = objectUrl;
  });
}
