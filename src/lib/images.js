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

// Crops an image to exactly fill a frame (CSS "cover"): scaled up until it
// covers the frame's shape, centered, extra edges trimmed — so a swapped-in
// deck picture never stretches. Frame size is in any unit; only the ratio
// matters. Resolves a JPEG blob `outWidth` px wide.
export async function coverCropToJpeg(blob, frameWidth, frameHeight, { outWidth = 2000, quality = 0.88 } = {}) {
  const bitmap = await createImageBitmap(blob);
  const outHeight = Math.round((outWidth * frameHeight) / frameWidth);
  const scale = Math.max(outWidth / bitmap.width, outHeight / bitmap.height);
  const drawW = bitmap.width * scale;
  const drawH = bitmap.height * scale;
  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;
  canvas.getContext("2d").drawImage(bitmap, (outWidth - drawW) / 2, (outHeight - drawH) / 2, drawW, drawH);
  bitmap.close?.();
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't prepare that picture."))), "image/jpeg", quality);
  });
}
