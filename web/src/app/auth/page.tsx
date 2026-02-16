"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Signing in...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }

    setStatus("Signed in ✅");
    router.push("/");
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Signing up...");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }

    setStatus("Signed up ✅ (check email if confirmation is enabled)");
  }

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold">Sign in</div>
          <p className="mt-1 text-sm text-zinc-600">
            Milestone 1: Supabase auth (email + password).
          </p>

          <form className="mt-4 space-y-3" onSubmit={signIn}>
            <label className="block">
              <div className="text-xs font-medium text-zinc-700">Email</div>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </label>

            <label className="block">
              <div className="text-xs font-medium text-zinc-700">Password</div>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                required
              />
            </label>

            <div className="flex gap-2 pt-2">
              <button
                className="flex-1 rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
                type="submit"
              >
                Sign in
              </button>
              <button
                className="flex-1 rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
                type="button"
                onClick={signUp}
              >
                Sign up
              </button>
            </div>

            <div className="pt-2 text-xs text-zinc-600">{status}</div>
          </form>
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Tip: If sign-up requires email confirmation, check your inbox.
        </p>
      </div>
    </main>
  );
}
