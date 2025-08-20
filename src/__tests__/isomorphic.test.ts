import { describe, expect, it } from 'vitest';
import { createHmacSha256, verifyHmacSignature } from '../utils/crypto';
import createDebug from '../utils/debug';

describe('Isomorphic Utilities', () => {
  describe('Crypto Utils', () => {
    it('should create HMAC-SHA256 signature', async () => {
      const secret = 'test-secret';
      const message = 'test-message';
      const signature = await createHmacSha256(secret, message);

      // Should be a hex string of 64 characters (256 bits / 4 bits per hex char)
      // biome-ignore lint/performance/useTopLevelRegex: test
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should verify valid HMAC signature', async () => {
      const secret = 'test-secret';
      const timestamp = '1234567890';
      const body = '{"test": "data"}';
      const message = `${timestamp}.${body}`;

      // Generate signature
      const signature = await createHmacSha256(secret, message);
      const formattedSignature = `sha256=${signature}`;

      // Verify signature
      const isValid = await verifyHmacSignature(
        secret,
        formattedSignature,
        timestamp,
        body
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid HMAC signature', async () => {
      const secret = 'test-secret';
      const timestamp = '1234567890';
      const body = '{"test": "data"}';

      // Use wrong signature
      const isValid = await verifyHmacSignature(
        secret,
        'sha256=invalid',
        timestamp,
        body
      );

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong format', async () => {
      const secret = 'test-secret';
      const timestamp = '1234567890';
      const body = '{"test": "data"}';

      // Missing sha256= prefix
      const isValid = await verifyHmacSignature(
        secret,
        'invalidsignature',
        timestamp,
        body
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Debug Utils', () => {
    it('should create debug function', () => {
      const debug = createDebug('test:namespace');
      expect(typeof debug).toBe('function');

      // Should not throw when called
      expect(() => {
        debug('test message');
        debug('formatted %s message', 'test');
        debug('number %d', 42);
        debug('object %O', { test: true });
      }).not.toThrow();
    });

    it('should handle various argument types', () => {
      const debug = createDebug('test:namespace');

      // Should handle different types without throwing
      expect(() => {
        debug('string');
        debug(123);
        debug({ object: true });
        debug(['array']);
        debug(null);
        debug(undefined);
      }).not.toThrow();
    });
  });
});
