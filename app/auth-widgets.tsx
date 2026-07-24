"use client";

import { ClerkProvider, SignIn, SignInButton, SignUp, UserButton } from "@clerk/nextjs";
import type { ReactNode } from "react";

export function AppClerkProvider({ children }: { children: ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}

export function SignInAction() {
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
  return (
    <main className="auth-page">
      <SignIn />
    </main>
  );
}

export function SignUpPanel() {
  return (
    <main className="auth-page">
      <SignUp />
    </main>
  );
}
