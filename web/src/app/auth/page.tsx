"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/Button";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [status, setStatus] = useState<string>("");

  async function signIn() {
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

  async function signUp() {
    setStatus("Signing up...");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role } },
    });

    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }

    setStatus("Signed up ✅ (check email if confirmation is enabled)");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signin") {
      await signIn();
    } else {
      await signUp();
    }
  }

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex gap-1 rounded-xl border bg-zinc-50 p-1">
            <button
              type="button"
              onClick={() => { setMode("signin"); setStatus(""); }}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm ${mode === "signin" ? "bg-zinc-900 text-white" : "text-zinc-600"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setStatus(""); }}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm ${mode === "signup" ? "bg-zinc-900 text-white" : "text-zinc-600"}`}
            >
              Sign up
            </button>
          </div>

          <div className="mt-4 text-lg font-semibold">
            {mode === "signin" ? "Welcome back" : "Create an account"}
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            {mode === "signin" ? "Sign in to your account." : "Set up a new student or mentor account."}
          </p>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
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
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
              />
            </label>

            {mode === "signup" && (
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">I am a</div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setRole("student")} className={`flex-1 rounded-xl border px-3 py-2 text-sm ${role === "student" ? "bg-zinc-900 text-white" : ""}`}>Student</button>
                  <button type="button" onClick={() => setRole("mentor")} className={`flex-1 rounded-xl border px-3 py-2 text-sm ${role === "mentor" ? "bg-zinc-900 text-white" : ""}`}>Mentor</button>
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button variant="primary" type="submit" className="w-full">
                {mode === "signin" ? "Sign in" : "Sign up"}
              </Button>
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
