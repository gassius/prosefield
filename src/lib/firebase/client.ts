"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  type Auth,
} from "firebase/auth";

type AuthWithFlag = Auth & { __prosefieldEmulatorConnected?: boolean };

function readPublicConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };
}

let authReady: Promise<Auth> | undefined;

export function getFirebaseApp(): FirebaseApp {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }
  return initializeApp(readPublicConfig());
}

export async function getClientAuth(): Promise<Auth> {
  if (!authReady) {
    authReady = (async () => {
      const app = getFirebaseApp();
      const auth = getAuth(app) as AuthWithFlag;
      await setPersistence(auth, inMemoryPersistence);

      const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
      if (emulatorHost && !auth.__prosefieldEmulatorConnected) {
        connectAuthEmulator(auth, `http://${emulatorHost}`, {
          disableWarnings: true,
        });
        auth.__prosefieldEmulatorConnected = true;
      }

      return auth;
    })();
  }
  return authReady;
}
