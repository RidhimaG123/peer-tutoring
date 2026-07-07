"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    async function checkAccess() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;

        if (!session) {
          router.replace("/auth");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (profile?.role !== "admin") {
          router.replace("/");
          return;
        }

        setLoading(false);
      } catch (err) {
        console.error("dashboard load error", err);
        setLoadError(true);
        setLoading(false);
      }
    }

    checkAccess();
  }, [router, retryCount]);

  if (loading) return (
    <main className="min-h-dvh bg-zinc-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-zinc-900" />
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    </main>
  );

  if (loadError) return (
    <main className="min-h-dvh bg-zinc-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-zinc-600">Something went wrong loading your dashboard.</p>
        <button
          onClick={() => { setLoadError(false); setLoading(true); setRetryCount((c) => c + 1); }}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-zinc-50"
        >
          Retry
        </button>
      </div>
    </main>
  );

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold">Admin Dashboard</div>
          <p className="mt-2 text-sm text-zinc-600">
            Manage users and oversee platform activity.
          </p>
        </div>
      </div>
    </main>
  );
}
