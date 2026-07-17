"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/Button";
import Card from "@/components/Card";

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
  const [role, setRole] = useState("student");
  const [status, setStatus] = useState<string>("");

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

    if (!profile?.role) {
      await supabase.auth.signOut();
      setStatus("Error: Could not verify account role.");
      return;
    }

    if (profile.role !== role) {
      await supabase.auth.signOut();
      setStatus(`This account is registered as a ${profile.role}. Please select ${profile.role} to sign in.`);
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
      options: { data: { role } },
    });

    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }

    setStatus("Signed up ✅ (check email if confirmation is enabled)");
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

    setStatus("Password reset email sent ✅ Check your inbox.");
  }

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-md px-4 py-10">
        <Card>
          <div className="text-lg font-semibold">{isSignupMode ? "Sign up" : "Sign in"}</div>
          <p className="mt-1 text-sm text-zinc-600">
            {isSignupMode ? "Create your account." : "Sign in to your account."}
          </p>

          <form className="mt-4 space-y-3" onSubmit={isSignupMode ? signUp : signIn}>
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
              <Button
                type="button"
                variant="link"
                onClick={handleForgotPassword}
                className="mt-1 text-xs"
              >
                Forgot password?
              </Button>
            </label>
            <div className="flex gap-2">
              <Button type="button" variant={role === "student" ? "primary" : "secondary"} onClick={() => setRole("student")} className="flex-1">Student</Button>
              <Button type="button" variant={role === "mentor" ? "primary" : "secondary"} onClick={() => setRole("mentor")} className="flex-1">Mentor</Button>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant={isSignupMode ? "secondary" : "primary"}
                type={isSignupMode ? "button" : "submit"}
                onClick={isSignupMode ? signIn : undefined}
                className="flex-1"
              >
                Sign in
              </Button>
              <Button
                variant={isSignupMode ? "primary" : "secondary"}
                type={isSignupMode ? "submit" : "button"}
                onClick={isSignupMode ? undefined : signUp}
                className="flex-1"
              >
                Sign up
              </Button>
            </div>

            <div className="pt-2 text-xs text-zinc-600">{status}</div>
          </form>
        </Card>

        <p className="mt-4 text-xs text-zinc-500">
          Tip: If sign-up requires email confirmation, check your inbox.
        </p>
      </div>
    </main>
  );
}
