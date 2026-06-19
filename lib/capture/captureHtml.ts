'use client';

/**
 * Render a self-contained HTML document inside an offscreen sandboxed iframe
 * and capture it to a PNG data URL via html2canvas. Fully client-side and free
 * (no screenshot API / headless browser needed).
 */

export const CAPTURE_WIDTH = 1024;
export const CAPTURE_HEIGHT = 640;

export async function captureHtml(
  html: string,
  width = CAPTURE_WIDTH,
  height = CAPTURE_HEIGHT,
): Promise<string> {
  // Lazy-import so html2canvas never ends up in the SSR/server bundle.
  const html2canvas = (await import('html2canvas')).default;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin');
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${width}px`,
    height: `${height}px`,
    border: '0',
    pointerEvents: 'none',
    opacity: '0',
  });
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      iframe.srcdoc = html;
      // Safety timeout in case onload never fires.
      window.setTimeout(resolve, 1500);
    });

    // Give styles/layout a moment to settle.
    await new Promise((r) => window.setTimeout(r, 250));

    const doc = iframe.contentDocument;
    const target = doc?.body ?? doc?.documentElement;
    if (!doc || !target) throw new Error('iframe document unavailable');

    const canvas = await html2canvas(target, {
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      backgroundColor: '#ffffff',
      scale: 1,
      useCORS: true,
      logging: false,
    });

    return canvas.toDataURL('image/png');
  } finally {
    iframe.remove();
  }
}
