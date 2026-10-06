import { describe, expect, it } from "vitest";
import { ApplicationInput, SettingsInput } from "./schema";

const valid = {
  name: " Ana ",
  email: " Ana@Example.org ",
  topics: "Sahel",
  message: "",
  consent: "on",
};

describe("volunteer applications", () => {
  it("accepts a filled form and normalises name and e-mail", () => {
    expect(ApplicationInput.parse(valid)).toMatchObject({ name: "Ana", email: "ana@example.org" });
  });

  it("answers with the code the form shows", () => {
    const issue = (input: object) =>
      ApplicationInput.safeParse({ ...valid, ...input }).error?.issues[0]?.message;
    expect(issue({ name: "  " })).toBe("name");
    expect(issue({ email: "nope" })).toBe("invalidEmail");
    expect(issue({ consent: undefined })).toBe("consent");
    expect(issue({ message: "x".repeat(2001) })).toBe("tooLong");
  });

  it("the address in the admin may be empty or an e-mail", () => {
    expect(SettingsInput.safeParse({ notify_email: "" }).success).toBe(true);
    expect(SettingsInput.parse({ notify_email: "Team@X.org" }).notify_email).toBe("team@x.org");
    expect(SettingsInput.safeParse({ notify_email: "team" }).success).toBe(false);
  });
});
