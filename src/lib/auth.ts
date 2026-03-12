import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";

const ADMIN_COOKIE_NAME = "paperbrief_admin";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;

type SessionPayload = {
  exp: number;
};

function getAdminSecret() {
  return env.ADMIN_PASSWORD ?? null;
}

function getCronSecret() {
  return env.CRON_SECRET ?? null;
}

function signValue(value: string, secret: string) {
  return createHmac("sha256", secret)
    .update(value)
    .digest("base64url");
}

function createSessionToken(payload: SessionPayload) {
  const adminSecret = getAdminSecret();
  if (!adminSecret) {
    throw new Error("ADMIN_PASSWORD is not configured.");
  }

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signValue(encoded, adminSecret)}`;
}

function verifySessionToken(token: string | undefined) {
  const adminSecret = getAdminSecret();
  if (!token || !adminSecret) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return false;
  }

  const expected = signValue(encodedPayload, adminSecret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;

    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

export async function setAdminSession() {
  const store = await cookies();
  const token = createSessionToken({
    exp: Date.now() + SESSION_DURATION_MS,
  });

  store.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE_NAME);
}

export async function isAdminAuthenticated() {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE_NAME)?.value);
}

export async function requireAdmin(next = "/admin") {
  if (!(await isAdminAuthenticated())) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
}

export function isAdminConfigured() {
  return Boolean(getAdminSecret());
}

export function verifyAdminPassword(input: string) {
  const adminSecret = getAdminSecret();
  if (!adminSecret) {
    return false;
  }

  const provided = Buffer.from(input);
  const expected = Buffer.from(adminSecret);

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

export function isValidCronSecret(secret: string | null) {
  const cronSecret = getCronSecret();
  if (!secret || !cronSecret) {
    return false;
  }

  const provided = Buffer.from(secret);
  const expected = Buffer.from(cronSecret);

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}
