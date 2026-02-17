"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type Role = "student" | "mentor";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>("student");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAuthed = !!session;

  const greeting = useMemo(() => {
    if (!isAuthed) return "Hello, you’re logged out.";
    return `Hello, you’re logged in as a ${role}.`;
  }, [isAuthed, role]);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-zinc-900" aria-hidden />
            <div>
              <div className="text-sm font-semibold leading-5">Peer Tutoring</div>
              <div className="text-xs text-zinc-600">MVP — tablet-first</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthed ? (
              <button
                className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
                onClick={handleSignOut}
                aria-label="Sign out"
              >
                Log out
              </button>
            ) : (
              <Link
                className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
                href="/auth"
                aria-label="Go to sign in"
              >
                Log in
              </Link>
            )}

            {isAuthed && (
              <span className="text-xs text-zinc-600 px-2">
                Role system coming in next step
              </span>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-base font-semibold">Status</div>
            <p className="mt-2 text-sm text-zinc-700">{greeting}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border p-4">
                <div className="text-sm font-semibold">Today’s Match</div>
                <div className="mt-1 text-sm text-zinc-600">
                  {isAuthed ? "Coming in v0.4 (daily matching)." : "Log in to see your match."}
                </div>
              </div>
              <div className="rounded-2xl border p-4">
                <div className="text-sm font-semibold">Quick Action</div>
                <div className="mt-1 text-sm text-zinc-600">
                  {isAuthed ? "Ask a question (v0.5)." : "Browse mentors (v0.3)."}
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-base font-semibold">Roadmap</div>
            <ul className="mt-2 space-y-2 text-sm text-zinc-700">
              <li>v0.1 Foundation ✅</li>
              <li>v0.2 Auth + roles</li>
              <li>v0.3 Profiles + directory</li>
              <li>v0.4 Daily matching</li>
              <li>v0.5 Ask + reply</li>
            </ul>
            <div className="mt-4 rounded-2xl bg-zinc-50 p-3 text-xs text-zinc-600">
              Tablet tip: resize to ~768px width — spacing should stay readable.
            </div>
          </aside>
        </div>
      </section>

      <footer className="mx-auto max-w-4xl px-4 pb-8 text-xs text-zinc-500">
        MVP focus: daily matching + visibility + lightweight interaction.
      </footer>
    </main>
  );
}
