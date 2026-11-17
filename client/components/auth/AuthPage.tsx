"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AuthForm from "./AuthForm";

interface AuthPageProps {
  mode: "login" | "register";
}

function AuthPageContent({ mode }: AuthPageProps) {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite") ?? undefined;

  return <AuthForm mode={mode} inviteCode={inviteCode} />;
}

export default function AuthPage({ mode }: AuthPageProps) {
  return (
    <Suspense
      fallback={
        <main
          aria-busy="true"
          className="flex min-h-screen items-center justify-center bg-[#09090f] px-4 text-sm text-gray-400"
        >
          Loading...
        </main>
      }
    >
      <AuthPageContent mode={mode} />
    </Suspense>
  );
}
