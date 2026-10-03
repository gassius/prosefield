"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { siteCopy } from "@/content/site";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  PASSWORD_MIN_LENGTH,
} from "@/features/auth/constants";
import { mapAuthError } from "@/features/auth/map-auth-error";
import { getClientAuth } from "@/lib/firebase/client";

type Mode = "login" | "register";

type AuthFormProps = {
  mode: Mode;
  nextPath: string;
};

function readCsrfFromDocument(): string | undefined {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : undefined;
}

export function AuthForm({ mode, nextPath }: AuthFormProps) {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const summaryId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function exchangeSession(idToken: string) {
    const token = readCsrfFromDocument();
    if (!token) {
      throw new Error("session_exchange_failed");
    }
    const response = await fetch("/api/session", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        [CSRF_HEADER_NAME]: token,
      },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      throw new Error("session_exchange_failed");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSummaryError(null);
    setEmailError(null);
    setPasswordError(null);
    setPending(true);

    try {
      const auth = await getClientAuth();
      const credential =
        mode === "register"
          ? await createUserWithEmailAndPassword(auth, email.trim(), password)
          : await signInWithEmailAndPassword(auth, email.trim(), password);

      const idToken = await credential.user.getIdToken();
      await exchangeSession(idToken);
      await signOut(auth);
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : undefined;

      if (error instanceof Error && error.message === "session_exchange_failed") {
        setSummaryError(siteCopy.auth.networkError);
        summaryRef.current?.focus();
      } else {
        const mapped = mapAuthError(code);
        if (mapped.field === "email") {
          setEmailError(mapped.message);
          emailRef.current?.focus();
        } else if (mapped.field === "password") {
          setPasswordError(mapped.message);
          passwordRef.current?.focus();
        } else {
          setSummaryError(mapped.message);
          summaryRef.current?.focus();
        }
      }
    } finally {
      setPending(false);
    }
  }

  const title =
    mode === "register" ? siteCopy.auth.registerTitle : siteCopy.auth.loginTitle;
  const lead =
    mode === "register" ? siteCopy.auth.registerLead : siteCopy.auth.loginLead;
  const submitLabel =
    mode === "register"
      ? siteCopy.auth.registerSubmit
      : siteCopy.auth.loginSubmit;

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex w-full max-w-md flex-col gap-6"
      noValidate
    >
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="font-display text-3xl font-medium tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">{lead}</p>
      </div>

      {summaryError ? (
        <div
          ref={summaryRef}
          id={summaryId}
          role="alert"
          tabIndex={-1}
          className="bg-destructive-soft text-destructive flex items-start gap-2 rounded-md px-3 py-2 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{summaryError}</span>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={emailId}>{siteCopy.auth.emailLabel}</Label>
        <Input
          ref={emailRef}
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? `${emailId}-error` : undefined}
          required
        />
        {emailError ? (
          <p
            id={`${emailId}-error`}
            className="text-destructive flex items-center gap-1.5 text-sm"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {emailError}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={passwordId}>{siteCopy.auth.passwordLabel}</Label>
        <Input
          ref={passwordRef}
          id={passwordId}
          name="password"
          type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={
            passwordError ? `${passwordId}-error` : `${passwordId}-hint`
          }
          minLength={PASSWORD_MIN_LENGTH}
          required
        />
        {passwordError ? (
          <p
            id={`${passwordId}-error`}
            className="text-destructive flex items-center gap-1.5 text-sm"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {passwordError}
          </p>
        ) : mode === "register" ? (
          <p id={`${passwordId}-hint`} className="text-muted-foreground text-sm">
            {siteCopy.auth.passwordHint}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Please wait…" : submitLabel}
      </Button>
    </form>
  );
}
