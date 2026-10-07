"use client";

import { useEffect, useRef } from "react";
import { generateStars, TWINKLES } from "./stars";

/** Above 2× the canvas only grows in memory, the specks look no sharper. */
const MAX_DPR = 2;

/**
 * Space behind the globe, as in Google Earth's zoomed-out view: a static
 * starfield and a faint sun glow in the corner. MapLibre clears its canvas
 * to transparent outside the sphere and its atmosphere, so this layer shows
 * through there.
 *
 * Cheap on purpose: the stars are painted once into a canvas (again only when
 * the window size changes), no animation loop. The field is the size of the
 * window and anchored bottom-left like the globe surface, so the shrinking
 * corner window on full-width pages just crops it instead of repainting it
 * frame by frame. A handful of CSS stars twinkle unless reduced motion is on.
 */
export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let painted = "";

    const paint = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const key = `${width}x${height}@${dpr}`;
      if (key === painted) return;
      painted = key;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      for (const star of generateStars(width, height)) {
        const x = star.x * width;
        const y = star.y * height;
        if (star.r > 1.1) {
          // The brightest few get a soft halo.
          const halo = context.createRadialGradient(x, y, 0, x, y, star.r * 4);
          halo.addColorStop(0, `rgba(${star.rgb}, ${star.alpha * 0.35})`);
          halo.addColorStop(1, `rgba(${star.rgb}, 0)`);
          context.fillStyle = halo;
          context.fillRect(x - star.r * 4, y - star.r * 4, star.r * 8, star.r * 8);
        }
        context.fillStyle = `rgba(${star.rgb}, ${star.alpha})`;
        context.beginPath();
        context.arc(x, y, star.r, 0, Math.PI * 2);
        context.fill();
      }
    };

    paint();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(paint, 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-0 left-0 -z-10 h-dvh w-screen overflow-hidden"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* The sun just beyond the top-right corner: its light, not a disc, so it
          never competes with the globe or the controls over it. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_99%_1%,rgba(255,244,222,0.42)_0,rgba(255,224,176,0.16)_3%,rgba(255,210,150,0.06)_14%,transparent_38%)]" />
      {TWINKLES.map((star) => (
        <span
          key={`${star.left}-${star.top}`}
          className="star-twinkle absolute size-[2px] rounded-full bg-white"
          style={{ left: `${star.left}%`, top: `${star.top}%`, animationDelay: `${star.delay}s` }}
        />
      ))}
    </div>
  );
}
