import { describe, expect, it } from "vitest";
import { SOCIALS } from "@/config/navigation";
import { socialNetwork } from "./SocialIcon";

describe("socialNetwork", () => {
  it("recognises every built-in profile", () => {
    expect(SOCIALS.map((social) => socialNetwork(social.href))).toEqual([
      "instagram",
      "linkedin",
      "facebook",
      "bluesky",
    ]);
  });

  it("accepts subdomains but not look-alike hosts", () => {
    expect(socialNetwork("https://cz.linkedin.com/company/x")).toBe("linkedin");
    expect(socialNetwork("https://m.facebook.com/x")).toBe("facebook");
    expect(socialNetwork("https://notfacebook.com/x")).toBeNull();
    expect(socialNetwork("https://instagram.com.evil.example/x")).toBeNull();
  });

  it("leaves other networks and broken addresses to the badge text", () => {
    expect(socialNetwork("https://www.youtube.com/@atlas")).toBeNull();
    expect(socialNetwork("not a url")).toBeNull();
  });
});
