/**
 * Resilient image loader that loads external AI images and converts to Base64 Data URL.
 * Uses a multi-tiered approach (Image element + Canvas -> fetch with no-referrer -> direct URL)
 * to completely bypass Cloudflare 403, CORS, and hotlinking restrictions in the browser.
 */

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const fetchImageAsDataUrl = async (
  url: string,
  timeoutMs: number = 25000
): Promise<string> => {
  // Method 1: Try Image Element + Canvas (Bypasses Cloudflare 403 on browser fetch)
  const imageElementPromise = new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      img.src = '';
      reject(new Error('TIMEOUT_IMG_ELEMENT'));
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1024;
        canvas.height = img.naturalHeight || 1024;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          resolve(dataUrl);
          return;
        }
      } catch (err) {
        console.warn('Canvas export tainted or failed, falling back to direct URL or fetch:', err);
      }
      resolve(url);
    };

    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('IMG_LOAD_ERROR'));
    };

    img.src = url;
  });

  try {
    return await imageElementPromise;
  } catch (err) {
    console.warn('Image element load failed, trying fetch with no-referrer...', err);
  }

  // Method 2: Fetch with no-referrer
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      referrerPolicy: 'no-referrer',
      headers: {
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const blob = await response.blob();
      return await blobToBase64(blob);
    }
  } catch (fetchErr) {
    clearTimeout(timeoutId);
    console.warn('Fetch with no-referrer failed:', fetchErr);
  }

  // Method 3: Direct URL as fallback (The browser <img> tag can still render it!)
  return url;
};
