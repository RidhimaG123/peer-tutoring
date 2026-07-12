"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/Button";
import Card from "@/components/Card";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      setStatus("Error: Passwords do not match");
      return;
    }

    setStatus("Updating password...");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }

    setStatus("Password updated ✅ Redirecting...");
    router.push("/");
  }

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-md px-4 py-10">
        <Card>
          <div className="text-lg font-semibold">Set a new password</div>
          <p className="mt-1 text-sm text-zinc-600">
            Followed the link from your reset email? Enter a new password below.
          </p>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <label className="block">
              <div className="text-xs font-medium text-zinc-700">New password</div>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                required
              />
            </label>

            <label className="block">
              <div className="text-xs font-medium text-zinc-700">Confirm new password</div>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                required
              />
            </label>

            <Button variant="primary" type="submit" className="w-full">
              Update password
            </Button>

            <div className="pt-2 text-xs text-zinc-600">{status}</div>
          </form>
        </Card>
      </div>
    </main>
  );
}
