import { describe, it, expect } from "vitest";
import { maskSensitiveData } from "./dlp";

describe("maskSensitiveData", () => {
  it("masks SSNs", () => {
    expect(maskSensitiveData("my ssn is 123-45-6789")).toBe("my ssn is [SSN REDACTED]");
  });

  it("masks credit cards", () => {
    expect(maskSensitiveData("card: 4111-1111-1111-1111")).toBe("card: [CARD REDACTED]");
  });

  it("masks emails", () => {
    expect(maskSensitiveData("email me at test@example.com")).toBe("email me at [EMAIL REDACTED]");
  });

  it("masks API keys", () => {
    expect(maskSensitiveData("key: sk-1234567890abcdef1234")).toBe("key: [API KEY REDACTED]");
  });

  it("masks AWS keys", () => {
    expect(maskSensitiveData("AKIAIOSFODNN7EXAMPLE")).toBe("[AWS KEY REDACTED]");
  });

  it("masks phone numbers", () => {
    expect(maskSensitiveData("call (555) 123-4567")).toBe("call [PHONE REDACTED]");
  });

  it("masks private IPs", () => {
    expect(maskSensitiveData("server at 192.168.1.100")).toBe("server at [IP REDACTED]");
  });

  it("leaves clean text unchanged", () => {
    const clean = "Hello, how are you?";
    expect(maskSensitiveData(clean)).toBe(clean);
  });
});
