import crypto from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

type OAuthState = { userId: string; createdAt: number; nonce: string };

function secret() {
  const value = process.env.CTRADER_STATE_SECRET;
  if (!value || value.length < 32) throw new Error("CTRADER_STATE_SECRET must be at least 32 characters.");
  return value;
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

export function createOAuthState(userId: string) {
  const payload: OAuthState = { userId, createdAt: Date.now(), nonce: crypto.randomUUID() };
  const encoded = encode(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(value: string): OAuthState {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) throw new Error("Invalid OAuth state.");
  const expected = crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("Invalid OAuth state signature.");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthState;
  if (!payload.userId || Date.now() - payload.createdAt > STATE_TTL_MS) throw new Error("OAuth state expired.");
  return payload;
}

export function getCtraderRedirectUri() {
  const configured = process.env.CTRADER_REDIRECT_URI;
  if (configured) return configured;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) throw new Error("CTRADER_REDIRECT_URI or NEXT_PUBLIC_SITE_URL is required.");
  return `${site.replace(/\/$/, "")}/api/ctrader/callback`;
}
