import crypto from "crypto";

export function generateBuildId(): string {
  return crypto.randomUUID();
}
