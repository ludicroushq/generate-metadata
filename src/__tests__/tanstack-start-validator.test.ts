import { describe, it, expect } from "vitest";
import { validator, type ApiMethod } from "../utils/api/tanstack-start";

describe("TanStack Start Validator", () => {
  describe("validator function", () => {
    it("should validate metadataGetLatest type with args", () => {
      const validData = {
        type: "metadataGetLatest" as const,
        args: {
          params: {
            path: { dsn: "test-dsn" },
            query: { path: "/test" },
          },
        },
      };

      const result = validator(validData);
      expect(result).toEqual(validData);
    });

    it("should validate placeholder type", () => {
      const validData = {
        type: "placeholder" as const,
      };

      const result = validator(validData);
      expect(result).toEqual(validData);
    });

    it("should throw error for invalid type", () => {
      const invalidData = {
        type: "invalidType",
        args: {},
      };

      expect(() => validator(invalidData)).toThrow();
    });

    it("should throw error for missing type", () => {
      const invalidData = {
        args: {},
      };

      expect(() => validator(invalidData)).toThrow();
    });

    it("should throw error for null", () => {
      expect(() => validator(null)).toThrow();
    });

    it("should throw error for undefined", () => {
      expect(() => validator(undefined)).toThrow();
    });

    it("should throw error for non-object values", () => {
      expect(() => validator("string")).toThrow();
      expect(() => validator(123)).toThrow();
      expect(() => validator(true)).toThrow();
      expect(() => validator([])).toThrow();
    });

    it("should accept metadataGetLatest with any args structure", () => {
      const validData = {
        type: "metadataGetLatest" as const,
        args: {
          // Any structure is valid for args
          foo: "bar",
          nested: {
            value: 123,
          },
        },
      };

      const result = validator(validData);
      expect(result).toEqual(validData);
    });

    it("should accept metadataGetLatest with empty args", () => {
      const validData = {
        type: "metadataGetLatest" as const,
        args: {},
      };

      const result = validator(validData);
      expect(result).toEqual(validData);
    });

    it("should accept metadataGetLatest with null args", () => {
      const validData = {
        type: "metadataGetLatest" as const,
        args: null,
      };

      const result = validator(validData);
      expect(result).toEqual(validData);
    });

    it("should strip unexpected properties from placeholder", () => {
      const data = {
        type: "placeholder" as const,
        unexpectedProp: "value",
      };

      // Zod strips extra properties by default
      const result = validator(data);
      expect(result).toEqual({
        type: "placeholder",
      });
    });

    it("should handle union discrimination correctly", () => {
      // Valid metadataGetLatest
      const valid1 = {
        type: "metadataGetLatest" as const,
        args: { test: true },
      };
      expect(() => validator(valid1)).not.toThrow();

      // Valid placeholder
      const valid2 = {
        type: "placeholder" as const,
      };
      expect(() => validator(valid2)).not.toThrow();

      // Invalid - wrong type
      const invalid1 = {
        type: "unknown" as any,
      };
      expect(() => validator(invalid1)).toThrow();

      // Valid - metadataGetLatest without args (z.any() accepts undefined)
      const valid3 = {
        type: "metadataGetLatest" as const,
      };
      // z.any() accepts undefined, so this is actually valid
      expect(() => validator(valid3)).not.toThrow();
    });
  });

  describe("ApiMethod type", () => {
    it("should be assignable from BaseApiClient method names", () => {
      const method: ApiMethod = "metadataGetLatest";
      expect(method).toBe("metadataGetLatest");
    });
  });
});
