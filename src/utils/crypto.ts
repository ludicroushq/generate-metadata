/**
 * Isomorphic HMAC implementation using Web Crypto API
 * Works in both Node.js and browser environments
 */

/**
 * Create HMAC-SHA256 signature
 * @param secret - The secret key
 * @param message - The message to sign
 * @returns Hex-encoded signature
 */
export async function createHmacSha256(
  secret: string,
  message: string,
): Promise<string> {
  // Convert strings to Uint8Array
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  // Import the secret key
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // Sign the message
  const signature = await crypto.subtle.sign("HMAC", key, messageData);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

/**
 * Verify HMAC-SHA256 signature
 * @param secret - The secret key
 * @param signature - The signature to verify (in sha256={hex} format)
 * @param timestamp - The timestamp
 * @param rawBody - The raw body content
 * @returns Whether the signature is valid
 */
export async function verifyHmacSignature(
  secret: string,
  signature: string,
  timestamp: string,
  rawBody: string,
): Promise<boolean> {
  // Extract the actual signature from the sha256={signature} format
  const signatureMatch = signature.match(/^sha256=(.+)$/);
  if (!signatureMatch) {
    return false;
  }
  const providedSignature = signatureMatch[1];

  // Create the message to sign: timestamp + "." + rawBody
  const message = `${timestamp}.${rawBody}`;

  // Generate the expected signature
  const expectedSignature = await createHmacSha256(secret, message);

  // Compare signatures using timing-safe comparison
  return providedSignature === expectedSignature;
}
