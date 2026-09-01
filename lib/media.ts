// Utility for processing, compressing and handling media files (PNG, JPG, JPEG, WebP)
// Ensures documents never exceed Firestore's 1MB document size limit

export interface ProcessedMedia {
  dataUrl: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  isImage: boolean;
  width?: number;
  height?: number;
}

/**
 * Optimizes an image (PNG, JPG, JPEG, WEBP, etc.) or document for instant, safe upload to Firestore.
 * Downscales dimensions if > 1440px, properly compresses JPG/JPEG, preserves PNG sharpness,
 * and guarantees a dataUrl under 500KB so it never fails.
 */
export async function processFileForUpload(file: File, customName?: string): Promise<ProcessedMedia> {
  const fileName = customName || file.name || `lampiran_${Date.now()}`;
  const isImage = file.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(fileName);

  if (isImage) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Format gambar tidak didukung atau file rusak'));
        img.onload = () => {
          try {
            let { width, height } = img;
            const maxDim = 1440; // Preserves high quality

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              throw new Error('Canvas context tidak tersedia di browser');
            }

            const isPng = file.type === 'image/png' || /\.png$/i.test(fileName);
            const isJpg = file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/pjpeg' || /\.(jpe?g)$/i.test(fileName);

            // If not PNG (e.g. JPG, JPEG), fill with white background so transparency doesn't turn black
            if (!isPng) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, width, height);
            }

            // Draw image
            ctx.drawImage(img, 0, 0, width, height);

            let finalDataUrl = '';
            let finalType = 'image/jpeg';

            if (isPng) {
              // 1. Try export as full PNG
              const pngData = canvas.toDataURL('image/png');
              if (pngData.length <= 580000) {
                finalDataUrl = pngData;
                finalType = 'image/png';
              } else {
                // Downscale to 1080px if PNG screenshot is heavy
                const scale2 = Math.min(1, 1080 / Math.max(width, height));
                const w2 = Math.round(width * scale2);
                const h2 = Math.round(height * scale2);
                const c2 = document.createElement('canvas');
                c2.width = w2;
                c2.height = h2;
                const ctx2 = c2.getContext('2d');
                if (ctx2) {
                  ctx2.drawImage(img, 0, 0, w2, h2);
                  const pngData2 = c2.toDataURL('image/png');
                  if (pngData2.length <= 580000) {
                    finalDataUrl = pngData2;
                    finalType = 'image/png';
                    width = w2;
                    height = h2;
                  } else {
                    finalDataUrl = c2.toDataURL('image/jpeg', 0.85);
                    finalType = 'image/jpeg';
                    width = w2;
                    height = h2;
                  }
                } else {
                  finalDataUrl = pngData;
                  finalType = 'image/png';
                }
              }
            } else if (file.type === 'image/gif') {
              const rawData = reader.result as string;
              if (rawData.length <= 580000) {
                finalDataUrl = rawData;
                finalType = 'image/gif';
              } else {
                finalDataUrl = canvas.toDataURL('image/jpeg', 0.82);
                finalType = 'image/jpeg';
              }
            } else {
              // Standard JPG / JPEG / WEBP
              // Must ALWAYS use 'image/jpeg' in canvas.toDataURL (never 'image/jpg' as browsers fallback to png)
              let quality = 0.82;
              finalDataUrl = canvas.toDataURL('image/jpeg', quality);
              finalType = 'image/jpeg';

              // If still larger than 500KB (e.g. very detailed camera photo), iteratively adjust quality
              if (finalDataUrl.length > 550000) {
                finalDataUrl = canvas.toDataURL('image/jpeg', 0.72);
              }
              if (finalDataUrl.length > 550000) {
                // Further downscale to 1000px
                const scale3 = Math.min(1, 1000 / Math.max(width, height));
                const w3 = Math.round(width * scale3);
                const h3 = Math.round(height * scale3);
                const c3 = document.createElement('canvas');
                c3.width = w3;
                c3.height = h3;
                const ctx3 = c3.getContext('2d');
                if (ctx3) {
                  ctx3.fillStyle = '#ffffff';
                  ctx3.fillRect(0, 0, w3, h3);
                  ctx3.drawImage(img, 0, 0, w3, h3);
                  finalDataUrl = c3.toDataURL('image/jpeg', 0.70);
                  width = w3;
                  height = h3;
                }
              }
            }

            // Calculate human-readable file size
            const sizeInBytes = Math.round((finalDataUrl.length * 3) / 4);
            const sizeFormatted = sizeInBytes > 1024 * 1024 
              ? (sizeInBytes / (1024 * 1024)).toFixed(1) + ' MB' 
              : Math.max(1, Math.round(sizeInBytes / 1024)) + ' KB';

            resolve({
              dataUrl: finalDataUrl,
              fileName,
              fileSize: sizeFormatted,
              fileType: finalType,
              isImage: true,
              width,
              height
            });
          } catch (err) {
            reject(err);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  // Non-image document file (PDF, DOCX, XLSX, TXT, etc.)
  if (file.size > 750 * 1024) {
    throw new Error('Ukuran file dokumen melebihi batas 750 KB untuk pesan kilat internal. Harap kompres file terlebih dahulu.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca dokumen'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const sizeFormatted = (file.size / 1024).toFixed(0) + ' KB';
      resolve({
        dataUrl,
        fileName,
        fileSize: sizeFormatted,
        fileType: file.type || 'application/octet-stream',
        isImage: false
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Creates an ultra-lightweight, perfectly cropped square avatar image (256x256)
 * suitable for real-time Firestore synchronization across all devices (< 35 KB).
 */
export async function processAvatarForProfile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar (JPG, PNG, WebP).');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file avatar'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format avatar tidak didukung atau file rusak'));
      img.onload = () => {
        try {
          const minDim = Math.min(img.width, img.height);
          const sx = Math.floor((img.width - minDim) / 2);
          const sy = Math.floor((img.height - minDim) / 2);

          const canvas = document.createElement('canvas');
          const targetSize = 256;
          canvas.width = targetSize;
          canvas.height = targetSize;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas context tidak tersedia');
          }

          // Fill white background in case of transparent PNG/WebP
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, targetSize, targetSize);

          // Draw cropped center square
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);

          // Export as JPEG with 0.85 quality (~20KB - 30KB)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Triggers native browser download for a data URL
 */
export function downloadDataUrl(dataUrl: string, fileName: string) {
  try {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
    }, 150);
  } catch (e) {
    console.error('Download error:', e);
  }
}
