"use client";

import Link from "next/link";
import { BookOpen, LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/Button";

export default function Nav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadRole(userId: string) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profile) setRole(profile.role);
    }

    async function load() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return;
      setAuthed(true);
      await loadRole(session.user.id);
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthed(false);
        setRole(null);
        return;
      }
      setAuthed(true);
      loadRole(session.user.id);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const dashboardHref =
    role === "admin" ? "/admin" : role === "mentor" ? "/mentor" : "/student";

  if (
    pathname === "/" || pathname === "/auth" || pathname === "/onboarding" ||
    pathname === "/student" || pathname.startsWith("/student/") ||
    pathname === "/mentor" || pathname.startsWith("/mentor/") ||
    pathname === "/admin" || pathname.startsWith("/admin/")
  ) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <BookOpen size={18} /> Peer Tutoring
        </Link>

        <div className="hidden sm:flex items-center gap-3 text-sm">
          {authed ? (
            <>
              <Link
                href={dashboardHref}
                className="text-zinc-600 hover:text-indigo-600 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/feed"
                className="text-zinc-600 hover:text-indigo-600 transition-colors"
              >
                Feed
              </Link>
              <Button
                variant="secondary"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setTimeout(() => { window.location.href = "/"; }, 500);
                }}
                className="px-3 py-2"
              >
                <span className="flex items-center gap-1"><LogOut size={14} /> Log out</span>
              </Button>
            </>
          ) : (
            <Link
              href="/auth"
              className="rounded-xl bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="sm:hidden rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="sm:hidden border-t bg-white px-4 py-3 flex flex-col gap-3 text-sm">
          {authed ? (
            <>
              <Link
                href={dashboardHref}
                className="text-zinc-600 hover:text-indigo-600 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href="/feed"
                className="text-zinc-600 hover:text-indigo-600 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Feed
              </Link>
              <Button
                variant="secondary"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setTimeout(() => { window.location.href = "/"; }, 500);
                }}
                className="px-3 py-2 w-full"
              >
                <span className="flex items-center justify-center gap-1"><LogOut size={14} /> Log out</span>
              </Button>
            </>
          ) : (
            <Link
              href="/auth"
              className="rounded-xl bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 transition-colors text-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign in
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
