import "server-only";

import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getEnv } from "@/lib/env";

function createAdminApp(): App {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  const env = getEnv();
  const usingEmulators = Boolean(
    env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST,
  );

  if (
    usingEmulators &&
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_EMULATORS !== "1"
  ) {
    throw new Error(
      "Firebase emulator hosts are set in a production environment without ALLOW_EMULATORS=1. Refusing to start (unsigned tokens would be accepted).",
    );
  }

  // Emulator mode: explicit projectId, no ADC. Disable GCP metadata probes so
  // google-auth-library does not emit MetadataLookupWarning / slow the first request.
  if (usingEmulators) {
    if (!process.env.METADATA_SERVER_DETECTION) {
      process.env.METADATA_SERVER_DETECTION = "none";
    }
    return initializeApp({ projectId: env.FIREBASE_PROJECT_ID });
  }

  return initializeApp({
    projectId: env.FIREBASE_PROJECT_ID,
    credential: applicationDefault(),
  });
}

export function getAdminApp(): App {
  return createAdminApp();
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}
