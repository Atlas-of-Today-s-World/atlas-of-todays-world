"use client";

import type { StyleSpecification } from "maplibre-gl";
import { GLOBE_COLORS } from "@/config/palette";
import { LAYERS } from "../mapStyle";

/**
 * WebGL drawn by the CPU instead of a graphics chip: SwiftShader (Chrome without
 * GPU access, headless browsers such as PageSpeed's), Mesa llvmpipe / softpipe,
 * Windows' Basic Render Driver. One frame of the globe then costs hundreds of
 * milliseconds of main-thread time, so the globe draws as few frames as it can:
 * pixel ratio 1, no satellite imagery (every arriving tile is another frame),
 * no idle motion (globe/useIdleSpin `auto`) — and it starts only when the
 * visitor asks for it (globe/startGate, the "Explore the globe" button): even a
 * lean globe's first frames are seconds of main-thread work.
 */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export const isSoftwareRenderer = (renderer: string) => SOFTWARE_RENDERER.test(renderer);

/** Pixel ratio of the globe when drawn in software: each extra pixel is CPU work. */
export const LOW_POWER_PIXEL_RATIO = 1;

let softwareRendering: boolean | undefined;

/**
 * Diagnostics and e2e tests: `localStorage["atlas-globe"] = "full"` draws the
 * full globe even in software (the tests that check the satellite credits).
 */
const FULL_GLOBE_KEY = "atlas-globe";

function fullGlobeForced(): boolean {
  try {
    return window.localStorage.getItem(FULL_GLOBE_KEY) === "full";
  } catch {
    return false; // storage blocked
  }
}

/**
 * Whether this browser draws WebGL in software, asked once of a throwaway
 * canvas before the map exists (so the map is created lean right away). The
 * probe's context is released at once.
 */
export function drawsInSoftware(): boolean {
  softwareRendering ??= !fullGlobeForced() && probeRenderer();
  return softwareRendering;
}

function probeRenderer(): boolean {
  const gl =
    document.createElement("canvas").getContext("webgl2") ??
    document.createElement("canvas").getContext("webgl");
  if (!gl) return false;
  try {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info
      ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    return typeof renderer === "string" && isSoftwareRenderer(renderer);
  } finally {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

/**
 * The style without satellite imagery: the layer stays (repaints address it)
 * but hidden, so MapLibre requests none of its tiles; the sea takes a plain
 * colour under the countries.
 */
export function lowPowerStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (layer.id === LAYERS.satellite) {
        return { ...layer, layout: { ...layer.layout, visibility: "none" } };
      }
      if (layer.type === "background") {
        return { ...layer, paint: { ...layer.paint, "background-color": GLOBE_COLORS.sea } };
      }
      return layer;
    }),
  };
}
