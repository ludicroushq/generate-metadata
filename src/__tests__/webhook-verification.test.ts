import { createHmac } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { GenerateMetadataClient } from "../next";
import type { webhooks } from "../__generated__/api";

const validMetadataUpdateBody: webhooks["webhook"]["post"]["requestBody"]["content"]["application/json"] =
  {
    _type: "metadata_update",
    path: "/test-path",
    metadataRevisionId: "rev-123",
    metadata: {},
    site: { hostname: "example.com", dsn: "dsn-123" },
    timestamp: new Date().toISOString(),
  };

// Mock Next.js utilities
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Webhook Verification", () => {
  const client = new GenerateMetadataClient({
    dsn: "test-dsn",
    apiKey: "test-api-key",
  });

  const revalidateSecret = "test-webhook-secret";

  // Helper function to generate HMAC signature
  const generateHmacSignature = (
    secret: string,
    timestamp: string,
    payload: unknown,
  ): string => {
    const rawBody = JSON.stringify(payload);
    const message = `${timestamp}.${rawBody}`;
    const signature = createHmac("sha256", secret)
      .update(message)
      .digest("hex");
    return `sha256=${signature}`;
  };

  // Helper function to create a mock request
  const createMockRequest = (options: {
    body: unknown;
    headers?: Record<string, string>;
    method?: string;
  }) => {
    const headers = new Headers();
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }
    headers.set("content-type", "application/json");

    return new Request("http://localhost/api/generate-metadata/revalidate", {
      method: options.method || "POST",
      headers,
      body: JSON.stringify(options.body),
    });
  };

  // Get the Hono app directly instead of using the handlers
  const getApp = () => {
    const app = (client as any).createRevalidateApp({ revalidateSecret });
    return app;
  };

  describe("HMAC Authentication", () => {
    it("should authenticate successfully with valid HMAC signature", async () => {
      const app = getApp();
      const timestamp = Date.now().toString();
      const signature = generateHmacSignature(
        revalidateSecret,
        timestamp,
        validMetadataUpdateBody,
      );

      const request = createMockRequest({
        body: validMetadataUpdateBody,
        headers: {
          "x-webhook-signature": signature,
          "x-webhook-timestamp": timestamp,
        },
      });

      const response = await app.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result).toEqual({
        ok: true,
        metadata: {
          revalidated: true,
          path: "/test-path",
        },
      });
    });

    it("should reject invalid HMAC signature", async () => {
      const app = getApp();
      const payload = { path: "/test-path" };
      const timestamp = Date.now().toString();
      const invalidSignature = "sha256=invalid-signature";

      const request = createMockRequest({
        body: payload,
        headers: {
          "x-webhook-signature": invalidSignature,
          "x-webhook-timestamp": timestamp,
        },
      });

      const response = await app.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result).toEqual({ ok: false, error: "Unauthorized" });
    });

    it("should reject HMAC signature with wrong format", async () => {
      const app = getApp();
      const payload = { path: "/test-path" };
      const timestamp = Date.now().toString();
      const invalidSignature = "invalid-format-signature";

      const request = createMockRequest({
        body: payload,
        headers: {
          "x-webhook-signature": invalidSignature,
          "x-webhook-timestamp": timestamp,
        },
      });

      const response = await app.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result).toEqual({ ok: false, error: "Unauthorized" });
    });

    it("should reject HMAC signature with tampered payload", async () => {
      const app = getApp();
      const originalPayload = { path: "/test-path" };
      const tamperedPayload = { path: "/tampered-path" };
      const timestamp = Date.now().toString();
      // Generate signature with original payload
      const signature = generateHmacSignature(
        revalidateSecret,
        timestamp,
        originalPayload,
      );

      // Send request with tampered payload
      const request = createMockRequest({
        body: tamperedPayload,
        headers: {
          "x-webhook-signature": signature,
          "x-webhook-timestamp": timestamp,
        },
      });

      const response = await app.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result).toEqual({ ok: false, error: "Unauthorized" });
    });

    it("should reject HMAC signature with wrong timestamp", async () => {
      const app = getApp();
      const payload = { path: "/test-path" };
      const originalTimestamp = Date.now().toString();
      const wrongTimestamp = (Date.now() + 1000).toString();
      // Generate signature with original timestamp
      const signature = generateHmacSignature(
        revalidateSecret,
        originalTimestamp,
        payload,
      );

      // Send request with wrong timestamp
      const request = createMockRequest({
        body: payload,
        headers: {
          "x-webhook-signature": signature,
          "x-webhook-timestamp": wrongTimestamp,
        },
      });

      const response = await app.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result).toEqual({ ok: false, error: "Unauthorized" });
    });
  });

  describe("Bearer Token Authentication (Backward Compatibility)", () => {
    it("should authenticate successfully with valid bearer token", async () => {
      const app = getApp();

      const request = createMockRequest({
        body: validMetadataUpdateBody,
        headers: {
          authorization: `Bearer ${revalidateSecret}`,
        },
      });

      const response = await app.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result).toEqual({
        ok: true,
        metadata: {
          revalidated: true,
          path: "/test-path",
        },
      });
    });

    it("should reject invalid bearer token", async () => {
      const app = getApp();
      const payload = { path: "/test-path" };

      const request = createMockRequest({
        body: payload,
        headers: {
          authorization: "Bearer invalid-token",
        },
      });

      const response = await app.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result).toEqual({ ok: false, error: "Unauthorized" });
    });

    it("should reject bearer token with wrong format", async () => {
      const app = getApp();
      const payload = { path: "/test-path" };

      const request = createMockRequest({
        body: payload,
        headers: {
          authorization: revalidateSecret, // Missing "Bearer " prefix
        },
      });

      const response = await app.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result).toEqual({ ok: false, error: "Unauthorized" });
    });
  });

  describe("Mixed Authentication Scenarios", () => {
    it("should prefer HMAC over bearer token when both are present", async () => {
      const app = getApp();
      const timestamp = Date.now().toString();
      const validSignature = generateHmacSignature(
        revalidateSecret,
        timestamp,
        validMetadataUpdateBody,
      );

      const request = createMockRequest({
        body: validMetadataUpdateBody,
        headers: {
          "x-webhook-signature": validSignature,
          "x-webhook-timestamp": timestamp,
          authorization: "Bearer invalid-token", // Invalid bearer token
        },
      });

      const response = await app.fetch(request);
      const result = await response.json();

      // Should succeed because HMAC is valid
      expect(response.status).toBe(200);
      expect(result).toEqual({
        ok: true,
        metadata: {
          revalidated: true,
          path: "/test-path",
        },
      });
    });

    it("should fall back to bearer token when HMAC is invalid", async () => {
      const app = getApp();
      const timestamp = Date.now().toString();

      const request = createMockRequest({
        body: validMetadataUpdateBody,
        headers: {
          "x-webhook-signature": "sha256=invalid-signature",
          "x-webhook-timestamp": timestamp,
          authorization: `Bearer ${revalidateSecret}`, // Valid bearer token
        },
      });

      const response = await app.fetch(request);
      const result = await response.json();

      // Should succeed because bearer token is valid
      expect(response.status).toBe(200);
      expect(result).toEqual({
        ok: true,
        metadata: {
          path: "/test-path",
          revalidated: true,
        },
      });
    });

    it("should reject when both HMAC and bearer token are invalid", async () => {
      const app = getApp();
      const payload = { path: "/test-path" };
      const timestamp = Date.now().toString();

      const request = createMockRequest({
        body: payload,
        headers: {
          "x-webhook-signature": "sha256=invalid-signature",
          "x-webhook-timestamp": timestamp,
          authorization: "Bearer invalid-token",
        },
      });

      const response = await app.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result).toEqual({ ok: false, error: "Unauthorized" });
    });

    it("should reject when no authentication headers are present", async () => {
      const app = getApp();
      const payload = { path: "/test-path" };

      const request = createMockRequest({
        body: payload,
        headers: {},
      });

      const response = await app.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result).toEqual({ ok: false, error: "Unauthorized" });
    });
  });

  describe("Request Validation", () => {
    it("should handle null path in request body", async () => {
      const app = getApp();
      const payload = { ...validMetadataUpdateBody, path: null };
      const timestamp = Date.now().toString();
      const signature = generateHmacSignature(
        revalidateSecret,
        timestamp,
        payload,
      );

      const request = createMockRequest({
        body: payload,
        headers: {
          "x-webhook-signature": signature,
          "x-webhook-timestamp": timestamp,
        },
      });

      const response = await app.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result).toEqual({
        ok: true,
        metadata: {
          path: null,
          revalidated: true,
        },
      });
    });

    it("should handle empty path string", async () => {
      const app = getApp();
      const payload = { ...validMetadataUpdateBody, path: "" };
      const timestamp = Date.now().toString();
      const signature = generateHmacSignature(
        revalidateSecret,
        timestamp,
        payload,
      );

      const request = createMockRequest({
        body: payload,
        headers: {
          "x-webhook-signature": signature,
          "x-webhook-timestamp": timestamp,
        },
      });

      const response = await app.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result).toEqual({
        ok: true,
        metadata: {
          path: "",
          revalidated: true,
        },
      });
    });
  });

  describe("Webhook Handler Integration", () => {
    it("should work with Next.js revalidateHandler", async () => {
      const handlers = client.revalidateHandler({ revalidateSecret });

      // handlers.POST is the Vercel adapter wrapper
      // We've already tested the Hono app directly above
      expect(typeof handlers.POST).toBe("function");
      expect(handlers.GET).toBe(handlers.POST);
      expect(handlers.PUT).toBe(handlers.POST);
      expect(handlers.PATCH).toBe(handlers.POST);
      expect(handlers.DELETE).toBe(handlers.POST);
      expect(handlers.OPTIONS).toBe(handlers.POST);
      expect(handlers.HEAD).toBe(handlers.POST);
    });
  });
});
