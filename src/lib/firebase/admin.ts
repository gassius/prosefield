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

  // Emulator mode: no credentials. Production/App Hosting: ADC / service account.
  if (usingEmulators) {
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
