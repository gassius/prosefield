/**
 * Billing integration against Docker emulators + Stripe SDK test helpers.
 * No real Stripe network — customers/sessions mocked; webhook uses generateTestHeaderString.
 */
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { __resetCookieStore } from "../mocks/next-headers";
import {
  FAKE_STRIPE_PRICE_ID,
  FAKE_STRIPE_SECRET_KEY,
  FAKE_STRIPE_WEBHOOK_SECRET,
} from "../fixtures/stripe";


const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;

if (!authHost || !firestoreHost) {
  throw new Error(
    "Integration tests require FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST (start with `pnpm backend:up`).",
  );
}

process.env.FIREBASE_PROJECT_ID ??= "demo-prosefield";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= "demo-prosefield";
process.env.APP_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??= "demo-api-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??=
  "demo-prosefield.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??=
  "1:000000000000:web:0000000000000000000000";
process.env.PLAN_DISPLAY_NAME ??= "Prosefield";
process.env.PLAN_DISPLAY_PRICE ??= "8";
process.env.PLAN_DISPLAY_CURRENCY ??= "EUR";
process.env.PLAN_DISPLAY_INTERVAL ??= "month";
process.env.FEATURE_CUSTOMER_PORTAL ??= "false";

const WEBHOOK_SECRET = FAKE_STRIPE_WEBHOOK_SECRET;
const TEST_SECRET = FAKE_STRIPE_SECRET_KEY;
const TEST_PRICE = FAKE_STRIPE_PRICE_ID;

process.env.STRIPE_SECRET_KEY = TEST_SECRET;
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.STRIPE_PRICE_ID = TEST_PRICE;

const customersCreate = vi.fn();
const sessionsCreate = vi.fn();
const subscriptionsRetrieve = vi.fn();

vi.mock("@/lib/stripe/server", async () => {
  const StripeCtor = (await import("stripe")).default;
  const real = new StripeCtor(TEST_SECRET);
  return {
    getStripe: () => ({
      customers: { create: customersCreate },
      checkout: { sessions: { create: sessionsCreate } },
      subscriptions: { retrieve: subscriptionsRetrieve },
      webhooks: real.webhooks,
    }),
    __resetStripeClientForTests: () => undefined,
  };
});

async function signUp(
  email: string,
  password: string,
): Promise<{ idToken: string; localId: string }> {
  const response = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`signUp failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as { idToken: string; localId: string };
}

describe("billing (emulators)", () => {
  beforeAll(async () => {
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    await import("@/lib/firebase/admin");
  });

  beforeEach(async () => {
    __resetCookieStore();
    customersCreate.mockReset();
    sessionsCreate.mockReset();
    subscriptionsRetrieve.mockReset();
    process.env.STRIPE_SECRET_KEY = TEST_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.STRIPE_PRICE_ID = TEST_PRICE;
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
  });

  it("POST /api/checkout returns 409 when already active and creates customer idempotently", async () => {
    const {
      createSessionCookieFromIdToken,
      setSessionCookie,
    } = await import("@/features/auth/session");
    const { upsertUserDocument } = await import("@/features/auth/users");
    const { getAdminFirestore } = await import("@/lib/firebase/admin");

    const email = `bill-${randomUUID()}@example.com`;
    const { idToken, localId } = await signUp(email, "password-123");
    const { sessionCookie } = await createSessionCookieFromIdToken(idToken);
    await upsertUserDocument({ uid: localId, email });
    await setSessionCookie(sessionCookie);

    await getAdminFirestore().collection("subscriptions").doc(localId).set({
      status: "active",
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_existing",
      stripePriceId: TEST_PRICE,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
      lastEventId: "evt_seed",
    });

    const { POST } = await import("@/app/api/checkout/route");
    const conflict = await POST(
      new Request("http://localhost:3000/api/checkout", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          accept: "application/json",
        },
      }),
    );
    expect(conflict.status).toBe(409);

    // Clear active so checkout can proceed for customer idempotency.
    await getAdminFirestore().collection("subscriptions").doc(localId).delete();

    customersCreate.mockResolvedValue({ id: "cus_new" });
    sessionsCreate.mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.com/c/pay/cs_1",
    });

    const created = await POST(
      new Request("http://localhost:3000/api/checkout", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          accept: "application/json",
        },
      }),
    );
    expect(created.status).toBe(200);
    const body = (await created.json()) as { url: string };
    expect(body.url).toContain("checkout.stripe.com");
    expect(customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email,
        metadata: { firebaseUid: localId },
      }),
      expect.objectContaining({ idempotencyKey: `customer-${localId}` }),
    );

    // Second checkout reuses stored customer (no second Stripe create).
    customersCreate.mockClear();
    sessionsCreate.mockResolvedValue({
      id: "cs_2",
      url: "https://checkout.stripe.com/c/pay/cs_2",
    });
    const again = await POST(
      new Request("http://localhost:3000/api/checkout", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          accept: "application/json",
        },
      }),
    );
    expect(again.status).toBe(200);
    expect(customersCreate).not.toHaveBeenCalled();
  });

  it("webhook rejects bad signatures and accepts signed events with dedupe", async () => {
    const { getAdminFirestore } = await import("@/lib/firebase/admin");
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const stripe = new Stripe(TEST_SECRET);

    const rejected = await POST(
      new Request("http://localhost:3000/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=bad" },
        body: "{}",
      }),
    );
    expect(rejected.status).toBe(400);

    const uid = `uid-${randomUUID()}`;
    const eventId = `evt_${randomUUID()}`;
    const subscription = {
      id: "sub_webhook",
      object: "subscription",
      status: "active",
      cancel_at_period_end: false,
      customer: "cus_webhook",
      metadata: { firebaseUid: uid },
      items: {
        object: "list",
        data: [
          {
            id: "si_1",
            object: "subscription_item",
            current_period_end: 1_900_000_000,
            current_period_start: 1_800_000_000,
            price: { id: TEST_PRICE },
          },
        ],
        has_more: false,
        url: "",
      },
    };

    subscriptionsRetrieve.mockResolvedValue(subscription);

    const payload = JSON.stringify({
      id: eventId,
      object: "event",
      type: "customer.subscription.updated",
      created: Math.floor(Date.now() / 1000),
      data: { object: { object: "subscription", id: "sub_webhook" } },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });

    const accepted = await POST(
      new Request("http://localhost:3000/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": signature },
        body: payload,
      }),
    );
    expect(accepted.status).toBe(200);
    const acceptedBody = (await accepted.json()) as {
      processed: boolean;
      handled: boolean;
    };
    expect(acceptedBody.handled).toBe(true);
    expect(acceptedBody.processed).toBe(true);

    const subSnap = await getAdminFirestore()
      .collection("subscriptions")
      .doc(uid)
      .get();
    expect(subSnap.exists).toBe(true);
    expect(subSnap.data()?.status).toBe("active");
    expect(subSnap.data()?.stripeSubscriptionId).toBe("sub_webhook");

    const eventSnap = await getAdminFirestore()
      .collection("stripeEvents")
      .doc(eventId)
      .get();
    expect(eventSnap.exists).toBe(true);

    // Duplicate delivery is a no-op.
    const duplicate = await POST(
      new Request("http://localhost:3000/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": signature },
        body: payload,
      }),
    );
    expect(duplicate.status).toBe(200);
    const dupBody = (await duplicate.json()) as { processed: boolean };
    expect(dupBody.processed).toBe(false);
  });
});
