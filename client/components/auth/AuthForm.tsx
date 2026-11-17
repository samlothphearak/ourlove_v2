"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Heart, LockKeyhole, Mail, UserRound } from "lucide-react";
import Button from "../ui/Button";
import { login, register } from "../../lib/auth";
import { useRouter } from "next/navigation";
import { acceptPartnerInvitation } from "../../lib/partner";

interface AuthFormProps {
  mode: "login" | "register";
  inviteCode?: string;
}

export default function AuthForm({ mode, inviteCode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authCompleted, setAuthCompleted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegister) {
        await register({ name, email, password });
      } else {
        await login({ email, password });
      }

      if (inviteCode) {
        try {
          await acceptPartnerInvitation(inviteCode);
        } catch (inviteError) {
          setAuthCompleted(true);
          setError(
            `You are signed in, but the invitation could not be accepted: ${
              inviteError instanceof Error
                ? inviteError.message
                : "Please try again."
            }`,
          );
          return;
        }
      }

      router.replace("/");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to complete your request. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const switchModeHref = inviteCode
    ? `/${isRegister ? "login" : "register"}?invite=${encodeURIComponent(inviteCode)}`
    : isRegister
      ? "/login"
      : "/register";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090f] px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#15151f] p-6 shadow-2xl shadow-pink-950/20 sm:p-9">
        <Link
          href="/"
          className="mb-9 inline-flex items-center gap-3"
          aria-label="OurLove home"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-500/15 text-pink-300">
            <Heart size={21} fill="currentColor" />
          </span>
          <span className="text-xl font-bold tracking-tight">
            OurLove<span className="text-pink-400">.</span>
          </span>
        </Link>

        <div className="mb-7">
          <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-pink-300">
            YOUR PRIVATE WORLD
          </p>
          <h1 className="text-3xl font-bold">
            {inviteCode
              ? isRegister
                ? "Create an account to join"
                : "Sign in to join"
              : isRegister
                ? "Create your account"
                : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            {inviteCode
              ? "Your account will be connected to the person who invited you."
              : isRegister
                ? "Start saving the moments that matter to both of you."
                : "Sign in to return to your shared space."}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {isRegister && (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-200">
                Your name
              </span>
              <span className="relative block">
                <UserRound
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
                  size={18}
                />
                <input
                  autoComplete="name"
                  className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-gray-500 focus:border-pink-400"
                  maxLength={50}
                  minLength={2}
                  name="name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  required
                  value={name}
                />
              </span>
            </label>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-200">
              Email address
            </span>
            <span className="relative block">
              <Mail
                aria-hidden="true"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
                size={18}
              />
              <input
                autoComplete="email"
                className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-gray-500 focus:border-pink-400"
                maxLength={254}
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-200">
              Password
            </span>
            <span className="relative block">
              <LockKeyhole
                aria-hidden="true"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
                size={18}
              />
              <input
                autoComplete={isRegister ? "new-password" : "current-password"}
                className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-gray-500 focus:border-pink-400"
                maxLength={72}
                minLength={8}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
                type="password"
                value={password}
              />
            </span>
          </label>

          {isRegister && (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-200">
                Confirm password
              </span>
              <span className="relative block">
                <LockKeyhole
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
                  size={18}
                />
                <input
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-gray-500 focus:border-pink-400"
                  maxLength={72}
                  minLength={8}
                  name="confirmPassword"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Enter your password again"
                  required
                  type="password"
                  value={confirmPassword}
                />
              </span>
            </label>
          )}

          {error && (
            <p
              className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
              role="alert"
            >
              {error}
            </p>
          )}

          {authCompleted && (
            <Link
              className="block text-center text-sm font-semibold text-pink-300 hover:text-pink-200"
              href="/"
            >
              Continue to OurLove
            </Link>
          )}

          <Button
            className="w-full"
            disabled={isSubmitting || authCompleted}
            type="submit"
          >
            {isSubmitting
              ? "Please wait..."
              : isRegister
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          {isRegister ? "Already have an account?" : "New to OurLove?"}{" "}
          <Link
            className="font-semibold text-pink-300 hover:text-pink-200"
            href={switchModeHref}
          >
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
