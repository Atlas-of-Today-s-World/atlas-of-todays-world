import { beforeEach, describe, expect, it, vi } from "vitest";

const signedIn = vi.hoisted(() => vi.fn());
const mfaGate = vi.hoisted(() => vi.fn());
const mfa = vi.hoisted(() => ({
  listFactors: vi.fn(),
  unenroll: vi.fn(),
  enroll: vi.fn(),
  challengeAndVerify: vi.fn(),
}));

vi.mock("@/lib/actions", () => ({ signedIn }));
vi.mock("./mfa", () => ({ mfaGate }));

const { startMfaEnrollment, verifyMfaCode } = await import("./mfa-actions");

const SESSION = { access_token: "access-token-secret", refresh_token: "refresh-token-secret" };

const factor = (id: string, status: "verified" | "unverified") => ({
  id,
  status,
  factor_type: "totp",
});
const factors = (...all: ReturnType<typeof factor>[]) => ({
  data: { all, totp: all.filter((f) => f.status === "verified"), phone: [] },
  error: null,
});

const noSecrets = (result: unknown) => {
  const json = JSON.stringify(result);
  expect(json).not.toContain(SESSION.access_token);
  expect(json).not.toContain(SESSION.refresh_token);
  expect(json).not.toMatch(/access_token|refresh_token/);
};

beforeEach(() => {
  signedIn.mockReset().mockResolvedValue({ user: { id: "u1" }, supabase: { auth: { mfa } } });
  mfaGate.mockReset().mockResolvedValue({ hasFactor: false });
  mfa.listFactors.mockReset().mockResolvedValue(factors());
  mfa.unenroll.mockReset().mockResolvedValue({ error: null });
  mfa.enroll.mockReset().mockResolvedValue({
    data: {
      id: "new-factor",
      type: "totp",
      totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "JBSWY3DP", uri: "otpauth://x" },
    },
    error: null,
  });
  mfa.challengeAndVerify.mockReset().mockResolvedValue({ data: SESSION, error: null });
});

describe("startMfaEnrollment", () => {
  it("returns only the QR code and the key to type in", async () => {
    const result = await startMfaEnrollment();
    expect(result).toEqual({
      ok: true,
      qr: "data:image/svg+xml;utf-8,<svg/>",
      secret: "JBSWY3DP",
    });
    noSecrets(result);
  });

  it("removes unfinished attempts before enrolling a new one", async () => {
    mfa.listFactors.mockResolvedValue(factors(factor("old", "unverified")));
    await startMfaEnrollment();
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "old" });
    expect(mfa.enroll).toHaveBeenCalledWith(expect.objectContaining({ factorType: "totp" }));
  });

  it("only for a role that needs a second factor and has none yet", async () => {
    mfaGate.mockResolvedValue(null);
    expect(await startMfaEnrollment()).toEqual({ ok: false, error: "notNeeded" });
    mfaGate.mockResolvedValue({ hasFactor: true });
    expect(await startMfaEnrollment()).toEqual({ ok: false, error: "notNeeded" });
    expect(mfa.enroll).not.toHaveBeenCalled();
    expect(mfa.unenroll).not.toHaveBeenCalled();
  });

  it("refuses a signed-out caller", async () => {
    signedIn.mockResolvedValue(null);
    expect(await startMfaEnrollment()).toEqual({ ok: false, error: "signIn" });
    expect(mfa.enroll).not.toHaveBeenCalled();
  });

  it("an Auth error is reported without details", async () => {
    mfa.enroll.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await startMfaEnrollment()).toEqual({ ok: false, error: "failed" });
  });
});

describe("verifyMfaCode", () => {
  it.each([["12345"], ["1234567"], ["abcdef"], [""], [123456], [null], [{ code: "123456" }]])(
    "refuses %j without asking Auth",
    async (input) => {
      expect(await verifyMfaCode(input)).toEqual({ ok: false, error: "code" });
      expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
    },
  );

  it("verifies against the user's verified factor and returns no session", async () => {
    mfa.listFactors.mockResolvedValue(
      factors(factor("pending", "unverified"), factor("phone-app", "verified")),
    );
    const result = await verifyMfaCode(" 123456 ");
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "phone-app", code: "123456" });
    expect(result).toEqual({ ok: true });
    noSecrets(result);
  });

  it("during enrolment it verifies the factor being enrolled", async () => {
    mfa.listFactors.mockResolvedValue(factors(factor("being-enrolled", "unverified")));
    expect(await verifyMfaCode("123456")).toEqual({ ok: true });
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({
      factorId: "being-enrolled",
      code: "123456",
    });
  });

  it("a wrong code is reported as such", async () => {
    mfa.listFactors.mockResolvedValue(factors(factor("phone-app", "verified")));
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { message: "invalid" } });
    expect(await verifyMfaCode("000000")).toEqual({ ok: false, error: "code" });
  });

  it("without any factor or session there is nothing to verify", async () => {
    expect(await verifyMfaCode("123456")).toEqual({ ok: false, error: "failed" });
    signedIn.mockResolvedValue(null);
    expect(await verifyMfaCode("123456")).toEqual({ ok: false, error: "signIn" });
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
  });
});
