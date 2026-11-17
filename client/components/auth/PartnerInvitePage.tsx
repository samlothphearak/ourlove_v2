"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Link2 } from "lucide-react";
import Button from "../ui/Button";
import { AuthError, getCurrentUser, type AuthUser } from "../../lib/auth";
import { acceptPartnerInvitation } from "../../lib/partner";

interface PartnerInvitePageProps {
  code: string;
}

export default function PartnerInvitePage({
  code,
}: PartnerInvitePageProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch((sessionError: unknown) => {
        if (!active) return;
        if (sessionError instanceof AuthError && sessionError.status === 401) {
          setUser(null);
          return;
        }
        setError(
          sessionError instanceof Error
            ? sessionError.message
            : "Unable to verify your session.",
        );
      })
      .finally(() => {
        if (active) setIsCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleAccept() {
    setError("");
    setIsAccepting(true);
    try {
      await acceptPartnerInvitation(code);
      router.replace("/");
      router.refresh();
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Unable to accept this invitation.",
      );
    } finally {
      setIsAccepting(false);
    }
  }

  const encodedCode = encodeURIComponent(code);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090f] px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#15151f] p-6 text-center shadow-2xl shadow-pink-950/20 sm:p-9">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/15 text-pink-300">
          <Heart size={22} fill="currentColor" />
        </div>
        <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-pink-300">
          OURLOVE INVITATION
        </p>
        <h1 className="text-2xl font-bold">Join your partner</h1>
        <p className="mt-3 text-sm leading-6 text-gray-400">
          Accept this invitation to connect your accounts and share your
          private space.
        </p>

        {error && (
          <p
            className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-7">
          {isCheckingSession ? (
            <p className="text-sm text-gray-400">Checking your account...</p>
          ) : user ? (
            <Button
              className="w-full"
              disabled={isAccepting}
              onClick={handleAccept}
            >
              {isAccepting ? "Connecting..." : "Accept invitation"}
            </Button>
          ) : (
            <div className="space-y-3">
              <Link
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-pink-400"
                href={`/register?invite=${encodedCode}`}
              >
                <Link2 size={17} />
                Create an account to join
              </Link>
              <Link
                className="block rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/5"
                href={`/login?invite=${encodedCode}`}
              >
                Already have an account? Sign in
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
