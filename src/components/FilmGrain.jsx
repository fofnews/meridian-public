// Animated film-grain overlay for the broadcast video surface (item 12).
//
// Rendered as a canvas drawn at 1/4 viewport resolution and scaled up
// via CSS — this gives ~4×4 px grain clusters that survive a
// YouTube/TikTok re-encode without aliasing. Scanlines were removed
// (they moiré badly under H.264 encoding). Pure random noise drawn at
// 24 fps gives the temporal shimmer of real film grain without
// repeating patterns.
//
// mix-blend-mode:overlay composites the mid-gray noise onto the map
// layer so highlights get a slight lift and shadows get a slight dip,
// matching how photographic grain interacts with exposure.

import { useEffect, useRef } from 'react';

const FPS = 24;
const FRAME_MS = 1000 / FPS;
const GRAIN_SCALE = 4; // canvas pixels → screen pixels

export default function FilmGrain({ opacity = 0.055 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId = null;
    let lastTick = 0;

    const resize = () => {
      canvas.width  = Math.max(1, Math.ceil(canvas.offsetWidth  / GRAIN_SCALE));
      canvas.height = Math.max(1, Math.ceil(canvas.offsetHeight / GRAIN_SCALE));
    };

    const draw = (now) => {
      rafId = requestAnimationFrame(draw);
      if (now - lastTick < FRAME_MS) return;
      lastTick = now;

      const { width, height } = canvas;
      const img = ctx.createImageData(width, height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    rafId = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity,
        mixBlendMode: 'overlay',
        imageRendering: 'pixelated',
        pointerEvents: 'none',
      }}
    />
  );
}
