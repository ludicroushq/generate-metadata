import { describe, it, expect, vi } from "vitest";
import { TanstackStartApiClient } from "../utils/api/tanstack-start";

describe("TanstackStartApiClient", () => {
  it("should call serverFn with correct data structure for metadataGetLatest", async () => {
    const mockServerFn = vi.fn().mockResolvedValue({
      data: {
        metadata: {
          title: "Test Title",
          description: "Test Description",
        },
      },
      error: undefined,
    }) as any;

    const apiClient = new TanstackStartApiClient(mockServerFn);

    const args = {
      params: {
        path: { dsn: "test-dsn" },
        query: { path: "/test" },
      },
      headers: {
        Authorization: "Bearer test-api-key",
      },
    };

    const result = await apiClient.metadataGetLatest(args);

    expect(mockServerFn).toHaveBeenCalledWith({
      data: {
        type: "metadataGetLatest",
        args,
      },
    });

    expect(result).toEqual({
      data: {
        metadata: {
          title: "Test Title",
          description: "Test Description",
        },
      },
      error: undefined,
    });
  });

  it("should handle serverFn errors", async () => {
    const mockError = new Error("ServerFn failed");
    const mockServerFn = vi.fn().mockRejectedValue(mockError) as any;

    const apiClient = new TanstackStartApiClient(mockServerFn);

    const args = {
      params: {
        path: { dsn: "test-dsn" },
        query: { path: "/test" },
      },
    };

    await expect(apiClient.metadataGetLatest(args)).rejects.toThrow(
      "ServerFn failed",
    );
    expect(mockServerFn).toHaveBeenCalled();
  });

  it("should pass through all arguments correctly", async () => {
    const mockServerFn = vi.fn().mockResolvedValue({
      data: {},
      error: undefined,
    }) as any;

    const apiClient = new TanstackStartApiClient(mockServerFn);

    const args = {
      params: {
        path: { dsn: "custom-dsn" },
        query: { path: "/custom/path" },
      },
      headers: {
        Authorization: "Bearer custom-key",
        "X-Custom-Header": "custom-value",
      },
      body: undefined,
      baseUrl: "https://custom.api.com",
    };

    await apiClient.metadataGetLatest(args);

    expect(mockServerFn).toHaveBeenCalledWith({
      data: {
        type: "metadataGetLatest",
        args,
      },
    });
  });

  it("should handle response with error", async () => {
    const mockServerFn = vi.fn().mockResolvedValue({
      data: undefined,
      error: {
        message: "Not found",
        code: 404,
      },
    }) as any;

    const apiClient = new TanstackStartApiClient(mockServerFn);

    const args = {
      params: {
        path: { dsn: "test-dsn" },
        query: { path: "/test" },
      },
    };

    const result = await apiClient.metadataGetLatest(args);

    expect(result).toEqual({
      data: undefined,
      error: {
        message: "Not found",
        code: 404,
      },
    });
  });

  it("should handle empty response", async () => {
    const mockServerFn = vi.fn().mockResolvedValue({}) as any;

    const apiClient = new TanstackStartApiClient(mockServerFn);

    const args = {
      params: {
        path: { dsn: "test-dsn" },
        query: { path: "/test" },
      },
    };

    const result = await apiClient.metadataGetLatest(args);

    expect(result).toEqual({});
  });
});
