"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type MentorProfile = {
  id: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  subjects: string[] | null;
};

export default function StudentDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mentors, setMentors] = useState<MentorProfile[]>([]);

  useEffect(() => {
    async function checkAccess() {
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

      if (profile?.role !== "student") {
        router.replace("/");
        return;
      }

      const { data: mentorsData } = await supabase
        .from("profiles")
        .select("id, display_name, headline, bio, subjects")
        .eq("role", "mentor")
        .order("created_at", { ascending: false });

      setMentors(mentorsData ?? []);
      setLoading(false);
    }

    checkAccess();
  }, [router]);

  if (loading) return null;

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold">Student Dashboard</div>
          <p className="mt-2 text-sm text-zinc-600">
            Browse mentors and profile details in this milestone.
          </p>
        </div>

        <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-base font-semibold">Mentor Directory</div>
          <p className="mt-2 text-sm text-zinc-600">
            {mentors.length === 0 ? "No mentors found yet." : `${mentors.length} mentor${mentors.length === 1 ? "" : "s"} available.`}
          </p>

          <div className="mt-4 grid gap-3">
            {mentors.map((mentor) => (
              <div key={mentor.id} className="rounded-xl border p-4">
                <div className="text-sm font-semibold">
                  {mentor.display_name || "Unnamed mentor"}
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  {mentor.headline || "No headline yet."}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
