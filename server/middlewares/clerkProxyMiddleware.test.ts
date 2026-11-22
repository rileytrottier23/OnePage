import { describe, it, expect } from "vitest";
import { getClientIp } from "./clerkProxyMiddleware";

describe("getClientIp", () => {
  it("prefers X-Real-IP set by the edge", () => {
    expect(
      getClientIp({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4, 203.0.113.7" }, "10.0.0.1")
    ).toBe("203.0.113.7");
  });

  it("ignores a spoofed first X-Forwarded-For entry", () => {
    expect(getClientIp({ "x-forwarded-for": "1.2.3.4, 198.51.100.9" }, "10.0.0.1")).toBe("198.51.100.9");
  });

  it("handles repeated X-Forwarded-For headers", () => {
    expect(getClientIp({ "x-forwarded-for": ["1.2.3.4", "198.51.100.9"] as any }, "10.0.0.1")).toBe(
      "198.51.100.9"
    );
  });

  it("falls back to the socket address", () => {
    expect(getClientIp({}, "10.0.0.1")).toBe("10.0.0.1");
    expect(getClientIp({})).toBe("");
  });
});
