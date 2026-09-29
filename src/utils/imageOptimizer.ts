/**
 * Otimizador de imagens no navegador
 * 
 * Resizes high-resolution photos to max 1600px, converts to WebP/JPEG at 85% quality,
 * corrects EXIF orientation, and ensures memory safety with zero external dependencies.
 */

export interface ImageOptimizationOptions {
  maxDimension?: number;
  quality?: number;
  format?: 'image/webp' | 'image/jpeg';
}

export interface OptimizedImageResult {
  dataUrl: string;
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  compressionRatio: number;
}

function calculateDimensions(
  srcWidth: number,
  srcHeight: number,
  maxDimension: number
): { targetWidth: number; targetHeight: number } {
  if (srcWidth <= 0 || srcHeight <= 0) {
    throw new Error('Dimensões inválidas da imagem original.');
  }

  if (srcWidth <= maxDimension && srcHeight <= maxDimension) {
    return { targetWidth: srcWidth, targetHeight: srcHeight };
  }

  if (srcWidth >= srcHeight) {
    const targetWidth = maxDimension;
    const targetHeight = Math.max(1, Math.round((srcHeight * maxDimension) / srcWidth));
    return { targetWidth, targetHeight };
  } else {
    const targetHeight = maxDimension;
    const targetWidth = Math.max(1, Math.round((srcWidth * maxDimension) / srcHeight));
    return { targetWidth, targetHeight };
  }
}

/**
 * Draw source image/bitmap onto canvas with appropriate dimension calculation and background fill.
 */
function renderToCanvas(
  source: ImageBitmap | HTMLImageElement,
  srcWidth: number,
  srcHeight: number,
  maxDimension: number,
  format: 'image/webp' | 'image/jpeg'
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const { targetWidth, targetHeight } = calculateDimensions(srcWidth, srcHeight, maxDimension);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d', { alpha: format !== 'image/jpeg' });
  if (!ctx) {
    throw new Error('Não foi possível obter o contexto 2D do Canvas.');
  }

  // Pre-fill white background if exporting to JPEG to avoid black transparent areas
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  // High quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

  return { canvas, width: targetWidth, height: targetHeight };
}

/**
 * Loads an image file using standard HTMLImageElement as fallback.
 */
function loadImageFallback(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Formato ou imagem corrompida. Não foi possível carregar a imagem.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Converts a Canvas element to a Blob with fallback if WebP is unsupported.
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: 'image/webp' | 'image/jpeg',
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else if (format === 'image/webp') {
          // Fallback to JPEG if WebP export is unsupported
          canvas.toBlob(
            (fallbackBlob) => {
              if (fallbackBlob) {
                resolve(fallbackBlob);
              } else {
                reject(new Error('Falha ao processar a imagem no navegador.'));
              }
            },
            'image/jpeg',
            quality
          );
        } else {
          reject(new Error('Falha ao gerar o arquivo de imagem otimizado.'));
        }
      },
      format,
      quality
    );
  });
}

/**
 * Converts a Blob to a base64 Data URL.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao ler o resultado otimizado da imagem.'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Erro ao converter imagem em base64.'));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Main optimization entry point.
 * Optimizes an uploaded File by resizing and compressing before state persistence and transmission.
 */
export async function optimizeImageFile(
  file: File,
  options?: ImageOptimizationOptions
): Promise<OptimizedImageResult> {
  if (!file) {
    throw new Error('Nenhum arquivo de imagem fornecido.');
  }

  // Validate that it is indeed an image or has an image extension
  const isImageMime = file.type ? file.type.startsWith('image/') : false;
  const hasImageExt = /\.(jpe?g|png|webp|avif|heic|heif)$/i.test(file.name);
  if (!isImageMime && !hasImageExt) {
    throw new Error('Formato inválido. Por favor, envie uma imagem nos formatos JPG, PNG ou WebP.');
  }

  const maxDimension = options?.maxDimension ?? 1600;
  const quality = options?.quality ?? 0.85;
  const format = options?.format ?? 'image/webp';

  let canvas: HTMLCanvasElement | null = null;
  let finalWidth = 0;
  let finalHeight = 0;
  let bitmap: ImageBitmap | null = null;

  try {
    // 1. First attempt: createImageBitmap with native EXIF orientation handling
    if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
      try {
        // Type-safe options for imageOrientation
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        // Browser might not support { imageOrientation: 'from-image' } options
        try {
          bitmap = await createImageBitmap(file);
        } catch {
          bitmap = null;
        }
      }
    }

    if (bitmap) {
      const renderResult = renderToCanvas(bitmap, bitmap.width, bitmap.height, maxDimension, format);
      canvas = renderResult.canvas;
      finalWidth = renderResult.width;
      finalHeight = renderResult.height;
    } else {
      // 2. Resilient fallback: standard HTMLImageElement + ObjectURL
      const img = await loadImageFallback(file);
      const renderResult = renderToCanvas(img, img.naturalWidth, img.naturalHeight, maxDimension, format);
      canvas = renderResult.canvas;
      finalWidth = renderResult.width;
      finalHeight = renderResult.height;
    }

    // 3. Export to optimized Blob & DataURL
    const blob = await canvasToBlob(canvas, format, quality);
    const dataUrl = await blobToDataUrl(blob);

    const originalSize = file.size;
    const compressedSize = blob.size;
    const compressionRatio = originalSize > 0
      ? Math.round(((originalSize - compressedSize) / originalSize) * 1000) / 10
      : 0;

    return {
      dataUrl,
      blob,
      originalSize,
      compressedSize,
      width: finalWidth,
      height: finalHeight,
      compressionRatio,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Falha desconhecida ao otimizar a imagem.';
    throw new Error(`Erro na otimização da imagem: ${errorMsg}`);
  } finally {
    // Clean up memory
    if (bitmap) {
      bitmap.close();
    }
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
