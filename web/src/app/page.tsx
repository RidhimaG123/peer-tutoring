"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import Card from "@/components/Card";

type Role = "student" | "mentor" | "admin";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [completedCount, setCompletedCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadRoleAndStats(userId: string) {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (!mounted) return;
      if (error || !profile) {
        setRole(null);
        return;
      }

      const userRole = profile.role as Role;
      setRole(userRole);

      if (userRole === "student" || userRole === "mentor") {
        const column = userRole === "mentor" ? "mentor_id" : "student_id";
        const { count } = await supabase
          .from("sessions")
          .select("*", { count: "exact", head: true })
          .eq(column, userId)
          .eq("status", "completed");

        if (!mounted) return;
        setCompletedCount(count ?? 0);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const s = data.session ?? null;
      setSession(s);
      if (s?.user?.id) loadRoleAndStats(s.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user?.id) {
        loadRoleAndStats(newSession.user.id);
      } else {
        setRole(null);
        setCompletedCount(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAuthed = !!session;
  const dashboardHref = role === "admin" ? "/admin" : role === "mentor" ? "/mentor" : "/student";
  const roleLabel = role === "admin" ? "Admin" : role === "mentor" ? "Mentor" : "Student";

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <section className="mx-auto max-w-4xl px-4 py-16">
        {isAuthed ? (
          <Card>
            {role && (
              <div className="text-sm font-medium text-indigo-600">{roleLabel}</div>
            )}
            <h1 className="mt-1 text-2xl font-semibold">Welcome back</h1>
            <p className="mt-2 text-sm text-zinc-600">
              {role ? `You’re signed in as a ${role}.` : "You’re signed in."}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Link
                href={dashboardHref}
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 transition-colors"
              >
                Go to Dashboard
              </Link>

              {completedCount !== null && (
                <div className="text-sm text-zinc-600">
                  <span className="text-lg font-semibold text-zinc-900">{completedCount}</span> sessions completed
                </div>
              )}
            </div>
          </Card>
        ) : (
          <div className="text-center">
            <h1 className="text-4xl font-semibold tracking-tight">Peer Tutoring</h1>
            <p className="mt-3 text-lg text-zinc-600">
              Connect with a peer mentor and get help in the subjects you need.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/auth"
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </section>

      <footer className="mx-auto max-w-4xl px-4 pb-8 text-center text-xs text-zinc-500">
        Peer Tutoring — Connecting students with mentors.
        <Link href="/admin/login" className="mt-2 block text-[10px] text-zinc-400 hover:text-zinc-500">
          Admin
        </Link>
      </footer>
    </main>
  );
}
