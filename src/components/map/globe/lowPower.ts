"use client";

/**
 * WebGL drawn by the CPU instead of a graphics chip: SwiftShader (Chrome without
 * GPU access, headless browsers such as PageSpeed's), Mesa llvmpipe / softpipe,
 * Windows' Basic Render Driver. One frame of the globe then costs hundreds of
 * milliseconds of main-thread time, so the globe draws only what the visitor
 * asks for (globe/useIdleSpin `auto`) and at pixel ratio 1.
 */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export const isSoftwareRenderer = (renderer: string) => SOFTWARE_RENDERER.test(renderer);

/** Pixel ratio of the globe when drawn in software: each extra pixel is CPU work. */
export const LOW_POWER_PIXEL_RATIO = 1;

/**
 * Whether the map's own WebGL context is drawn in software. Asking the canvas
 * for its context type again returns the context MapLibre already created.
 */
export function drawsInSoftware(canvas: HTMLCanvasElement): boolean {
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) return false;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = info
    ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  return typeof renderer === "string" && isSoftwareRenderer(renderer);
}
