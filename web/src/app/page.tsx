"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "student" | "mentor" | "admin";

export default function Home() {
  const router = useRouter();
  const [showHero, setShowHero] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function handleSession(userId: string | undefined) {
      if (!userId) {
        if (mounted) setShowHero(true);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (!mounted) return;

      const role = profile?.role as Role | undefined;
      if (!role) {
        setShowHero(true);
        return;
      }

      router.replace(role === "admin" ? "/admin" : role === "mentor" ? "/mentor" : "/student");
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      handleSession(data.session?.user?.id);
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  if (!showHero) {
    return <main className="min-h-dvh bg-[#0a0a0a]" />;
  }

  return (
    <main className="min-h-dvh bg-[#0a0a0a] text-white">
      <section className="mx-auto max-w-5xl px-4 py-24 text-center">
        <h1 className="text-5xl font-semibold tracking-tight">PeerPrep</h1>
        <p className="mt-4 text-lg text-zinc-400">students teaching students</p>

        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/auth?mode=signup"
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Get started
          </Link>
          <Link
            href="/auth?mode=login"
            className="rounded-xl border border-zinc-400 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-900 transition-colors"
          >
            Log in
          </Link>
        </div>

        <div className="mt-20 grid gap-6 text-left sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="text-sm font-semibold text-indigo-400">Tell us about you</div>
            <p className="mt-2 text-sm text-zinc-400">
              Add your subjects and a little about how you like to learn or teach, so we know what to look for.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="text-sm font-semibold text-indigo-400">Get matched</div>
            <p className="mt-2 text-sm text-zinc-400">
              We pair you with someone who’s into the same subjects, so you’re not starting from scratch every time.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="text-sm font-semibold text-indigo-400">Learn together</div>
            <p className="mt-2 text-sm text-zinc-400">
              Pick a time, hop on a call, and work through it together. Leave a rating once you’re done.
            </p>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-center">
        <Link href="/admin/login" className="text-xs text-zinc-600 hover:text-zinc-400">
          Admin
        </Link>
      </footer>
    </main>
  );
}
