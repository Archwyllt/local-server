import { describe, it, expect, beforeAll } from "vitest";
import { hashPassword, checkPasswordHash, makeJWT, validateJWT, getBearerToken } from "./auth.js";

// ... existing Password Hashing tests ...

// ... existing JWT Creation and Validation tests ...

describe("Bearer Token Extraction", () => {
  it("should extract token from valid Authorization header", () => {
    const mockReq = {
      get: (header: string) => {
        if (header === "Authorization") {
          return "Bearer test-token-123";
        }
        return undefined;
      }
    } as any;

    const token = getBearerToken(mockReq);
    expect(token).toBe("test-token-123");
  });

  it("should throw error if Authorization header is missing", () => {
    const mockReq = {
      get: (header: string) => undefined
    } as any;

    expect(() => {
      getBearerToken(mockReq);
    }).toThrow("Authorization header missing");
  });

  it("should throw error if Authorization header format is invalid", () => {
    const mockReq = {
      get: (header: string) => {
        if (header === "Authorization") {
          return "InvalidFormat token-123";
        }
        return undefined;
      }
    } as any;

    expect(() => {
      getBearerToken(mockReq);
    }).toThrow("Invalid Authorization header format");
  });

  it("should throw error if Bearer keyword is missing", () => {
    const mockReq = {
      get: (header: string) => {
        if (header === "Authorization") {
          return "token-123";
        }
        return undefined;
      }
    } as any;

    expect(() => {
      getBearerToken(mockReq);
    }).toThrow("Invalid Authorization header format");
  });
});
