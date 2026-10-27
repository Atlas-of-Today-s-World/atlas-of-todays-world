import { describe, expect, it } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import { GLOBE_COLORS } from "@/config/palette";
import { LAYERS } from "../mapStyle";
import { isSoftwareRenderer, lowPowerStyle } from "./lowPower";

describe("software WebGL detection", () => {
  it("recognises CPU renderers", () => {
    for (const name of [
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
      "Google SwiftShader",
      "llvmpipe (LLVM 15.0.7, 256 bits)",
      "softpipe",
      "ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0)",
    ]) {
      expect(isSoftwareRenderer(name), name).toBe(true);
    }
  });

  it("leaves graphics chips alone", () => {
    for (const name of [
      "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
      "Adreno (TM) 640",
      "Mali-G78",
      "Apple GPU",
      "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)",
      "WebKit WebGL",
    ]) {
      expect(isSoftwareRenderer(name), name).toBe(false);
    }
  });
});

describe("the lean style for software WebGL", () => {
  const style = {
    version: 8,
    sources: {},
    layers: [
      { id: "space", type: "background", paint: { "background-color": "#000000" } },
      { id: LAYERS.satellite, type: "raster", source: "satellite", paint: { "raster-opacity": 1 } },
      { id: LAYERS.fill, type: "fill", source: "countries", paint: { "fill-opacity": 0.6 } },
    ],
  } as StyleSpecification;

  it("hides the satellite imagery but keeps its layer for repaints", () => {
    const satellite = lowPowerStyle(style).layers.find((layer) => layer.id === LAYERS.satellite);
    expect(satellite?.layout).toEqual({ visibility: "none" });
    expect(satellite).toMatchObject({ paint: { "raster-opacity": 1 } });
  });

  it("paints the sea a plain colour and leaves the countries alone", () => {
    const [background, , fill] = lowPowerStyle(style).layers;
    expect(background).toMatchObject({ paint: { "background-color": GLOBE_COLORS.sea } });
    expect(fill).toBe(style.layers[2]);
  });
});
