"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSignupMode = searchParams.get("mode") === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Signing in...");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.session?.user?.id)
      .single();

    const role = profile?.role;
    router.push(role === "admin" ? "/admin" : role === "mentor" ? "/mentor" : "/student");
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      setStatus("Passwords do not match");
      return;
    }

    setStatus("Creating account...");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }

    if (!data.session) {
      setStatus("Check your inbox to confirm your email, then log in.");
      return;
    }

    router.push("/onboarding");
  }

  async function handleForgotPassword() {
    if (!email) {
      setStatus("Error: Enter your email above first");
      return;
    }

    setStatus("Sending reset email...");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }

    setStatus("Password reset email sent. Check your inbox.");
  }

  return (
    <main className="min-h-dvh bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-md px-4 py-20">
        <h1 className="text-2xl font-semibold">{isSignupMode ? "Create your account" : "Welcome back"}</h1>

        <form className="mt-6 space-y-4" onSubmit={isSignupMode ? signUp : signIn}>
          <label className="block">
            <div className="text-xs font-medium text-zinc-400">Email</div>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-zinc-400">Password</div>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={isSignupMode ? "new-password" : "current-password"}
              required
            />
          </label>

          {isSignupMode ? (
            <label className="block">
              <div className="text-xs font-medium text-zinc-400">Confirm password</div>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Forgot password?
            </button>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            {isSignupMode ? "Create account" : "Sign in"}
          </button>

          {status && <div className="text-xs text-zinc-400">{status}</div>}

          <div className="text-center text-xs text-zinc-500">
            {isSignupMode ? (
              <>
                Already have an account?{" "}
                <Link href="/auth?mode=login" className="text-indigo-400 hover:text-indigo-300">
                  Log in
                </Link>
              </>
            ) : (
              <>
                Don’t have an account?{" "}
                <Link href="/auth?mode=signup" className="text-indigo-400 hover:text-indigo-300">
                  Get started
                </Link>
              </>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
