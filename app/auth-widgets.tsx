"use client";

import { ClerkProvider, SignIn, SignInButton, SignUp, UserButton, useAuth } from "@clerk/react";
import type { ReactNode } from "react";

export function AppClerkProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/"
      afterSignUpUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}

export function SignInAction() {
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return (
      <button className="upload-button" onClick={() => window.location.assign("/")}>
        Open workspace
      </button>
    );
  }

  return (
    <SignInButton mode="modal">
      <button className="upload-button">Sign in</button>
    </SignInButton>
  );
}

export function AccountButton() {
  return <UserButton />;
}

export function SignInPanel() {
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">SIGNED IN</p>
          <h1>You are already signed in.</h1>
          <p>Open the workspace instead of starting another sign-in flow.</p>
          <button className="upload-button" onClick={() => window.location.assign("/")}>
            Open workspace
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <SignIn routing="path" path="/sign-in" />
    </main>
  );
}

export function SignUpPanel() {
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">SIGNED IN</p>
          <h1>You are already signed in.</h1>
          <p>Open the workspace instead of creating another session.</p>
          <button className="upload-button" onClick={() => window.location.assign("/")}>
            Open workspace
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <SignUp routing="path" path="/sign-up" />
    </main>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">LOADING SESSION</p>
          <h1>Checking your workspace access…</h1>
          <p>Clerk is restoring your local session.</p>
        </section>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">PRIVATE ALPHA</p>
          <h1>Level Grind Context Infra</h1>
          <p>
            Sign in to your invited account before opening the research context
            workspace.
          </p>
          <SignInAction />
        </section>
      </main>
    );
  }

  return (
    <>
      <div className="session-corner">
        <AccountButton />
      </div>
      {children}
    </>
  );
}
