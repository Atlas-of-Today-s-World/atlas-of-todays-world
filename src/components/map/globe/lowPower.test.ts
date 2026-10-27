import { describe, expect, it } from "vitest";
import { isSoftwareRenderer } from "./lowPower";

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
