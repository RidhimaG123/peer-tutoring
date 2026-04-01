"use client";

import Link from "next/link";
import { BookOpen, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Nav() {
  const [role, setRole] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return;
      setAuthed(true);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile) setRole(profile.role);
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setAuthed(false);
        setRole(null);
        return;
      }
      setAuthed(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (profile) setRole(profile.role);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const dashboardHref =
    role === "admin" ? "/admin" : role === "mentor" ? "/mentor" : "/student";

  return (
    <nav className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <BookOpen size={18} /> Peer Tutoring
        </Link>

        <div className="flex items-center gap-3 text-sm">
          {authed ? (
            <>
              <Link
                href={dashboardHref}
                className="text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/feed"
                className="text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                Feed
              </Link>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/";
                }}
                className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50 transition-colors"
              >
                <span className="flex items-center gap-1"><LogOut size={14} /> Log out</span>
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
