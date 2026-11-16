/**
 * Client-side image compression and resizing utility.
 * Resizes large smartphone camera photos (5-15MB) down to <= 1600px max dimension
 * and compresses them to ~200-400KB JPEG in milliseconds.
 */

export async function compressAndPrepareImage(file, maxDimension = 1600, quality = 0.8) {
  if (!file) {
    throw new Error('No file provided for compression');
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Calculate constrained dimensions preserving aspect ratio
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to create canvas 2D rendering context'));
        return;
      }

      // Draw with white background in case of transparent png
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, quality);
      // Strip off the "data:image/jpeg;base64," prefix for API consumption
      const base64Data = dataUrl.split(',')[1];

      resolve({
        base64: base64Data,
        mimeType,
        previewUrl: dataUrl,
        width,
        height
      });
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression: ' + (err?.message || 'unknown error')));
    };

    img.src = objectUrl;
  });
}
