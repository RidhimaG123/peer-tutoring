"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";


export default function FeedPage() {
  const [completedCount, setCompletedCount] = useState(0);

  const [topMentors, setTopMentors] = useState<{ mentor_id: string; count: number }[]>([]);
  const [recentQuestions, setRecentQuestions] = useState<{ subject: string; created_at: string }[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ type: string; created_at: string }[]>([]);
  useEffect(() => {
    async function loadFeed() {
      const { count } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed");

      const { data: sessions } = await supabase
        .from("sessions")
        .select("mentor_id")
        .eq("status", "completed");

      const counts: Record<string, number> = {};
      (sessions ?? []).forEach((s) => {
        counts[s.mentor_id] = (counts[s.mentor_id] || 0) + 1;
      });

      const sorted = Object.entries(counts)
        .map(([mentor_id, count]) => ({ mentor_id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);


      const { data: activity } = await supabase
        .from("sessions")
        .select("status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      const formatted = (activity ?? []).map((a) => ({
        type: a.status === "completed" ? "Session completed" : "New help request" ,
        created_at: a.created_at
      }));

      setRecentActivity(formatted);
      setTopMentors(sorted);

      setCompletedCount(count ?? 0);
    }

    loadFeed();
  }, []);

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold">School Feed</div>
          <p className="mt-2 text-sm text-zinc-600">Feed activity will appear here.</p>
          <div className="mt-4 text-sm text-zinc-700">
            Sessions completed: <span className="font-semibold">{completedCount}</span>
          </div>
          <div className="mt-6">
            <div className="text-sm font-semibold">Top mentors this week</div>
            <div className="mt-2 space-y-1 text-sm text-zinc-700">
              {topMentors.length === 0 ? (
                <p>No activity yet.</p>
              ) : (
                topMentors.map((m, i) => (
                  <div key={m.mentor_id}>
                    #{i + 1} — {m.count} sessions
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="mt-6">
            <div className="text-sm font-semibold">Recent activity</div>
            <div className="mt-2 space-y-1 text-sm text-zinc-700">
              {recentActivity.length === 0 ? (
                <p>No activity yet.</p>
              ) : (
                recentActivity.map((a, i) => (
                  <div key={i}>
                    {a.type}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
