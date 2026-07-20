"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/Button";
import Card from "@/components/Card";

const ADMIN_EMAIL = "ridhimag2009@gmail.com";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    const signedInEmail = data.session?.user?.email;
    const userId = data.session?.user?.id;

    if (!userId || signedInEmail !== ADMIN_EMAIL) {
      await supabase.auth.signOut();
      setStatus("Access denied.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profile?.role !== "admin") {
      await supabase.auth.signOut();
      setStatus("Access denied.");
      return;
    }

    router.push("/admin");
  }

  return (
    <main className="min-h-dvh bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-md px-4 py-10">
        <Card className="!bg-zinc-900 !border-zinc-800 !text-white">
          <div className="text-lg font-semibold">Welcome, Admin</div>
          <p className="mt-1 text-sm text-zinc-400">
            Sign in to access the admin dashboard.
          </p>

          <form className="mt-4 space-y-3" onSubmit={signIn}>
            <label className="block">
              <div className="text-xs font-medium text-zinc-300">Email</div>
              <input
                className="mt-1 w-full rounded-xl border bg-zinc-950 border-zinc-700 text-white placeholder-zinc-500 px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </label>

            <label className="block">
              <div className="text-xs font-medium text-zinc-300">Password</div>
              <input
                className="mt-1 w-full rounded-xl border bg-zinc-950 border-zinc-700 text-white placeholder-zinc-500 px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                required
              />
            </label>

            <Button variant="primary" type="submit" className="w-full">
              Sign in
            </Button>

            <div className="pt-2 text-xs text-zinc-400">{status}</div>
          </form>
        </Card>
      </div>
    </main>
  );
}
