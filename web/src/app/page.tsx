"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type Role = "student" | "mentor" | "admin";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadRole(userId: string) {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (!mounted) return;
      if (error) {
        setRole(null);
        return;
      }
      setRole((data?.role as Role) ?? null);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const s = data.session ?? null;
      setSession(s);
      if (s?.user?.id) loadRole(s.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user?.id) loadRole(newSession.user.id);
      else setRole(null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAuthed = !!session;

  const greeting = useMemo(() => {
    if (!isAuthed) return "Hello, you’re logged out.";
    if (!role) return "Hello, you’re logged in.";
    return `Hello, you’re logged in as a ${role}.`;
  }, [isAuthed, role]);


  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">

      <section className="mx-auto max-w-4xl px-4 py-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-base font-semibold">Status</div>
            <p className="mt-2 text-sm text-zinc-700">{greeting}</p>


            {isAuthed && role && (
              <div className="mt-3">
                <Link
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
                  href={
                    role === "admin"
                      ? "/admin"
                      : role === "mentor"
                      ? "/mentor"
                      : "/student"
                  }
                >
                  Go to {role === "admin" ? "Admin" : role === "mentor" ? "Mentor" : "Student"} Dashboard
                </Link>
              </div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border p-4">
                <div className="text-sm font-semibold">Today’s Match</div>
                <div className="mt-1 text-sm text-zinc-600">
                  {isAuthed ? "View your matched tutor for today." : "Log in to see your match."}
                </div>
              </div>
              <div className="rounded-2xl border p-4">
                <div className="text-sm font-semibold">Quick Action</div>
                <div className="mt-1 text-sm text-zinc-600">
                  {isAuthed ? "Request a tutoring session." : "Find a tutor for any subject."}
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <footer className="mx-auto max-w-4xl px-4 pb-8 text-xs text-zinc-500">
        Peer Tutoring — Connecting students with mentors.
      </footer>
    </main>
  );
}
