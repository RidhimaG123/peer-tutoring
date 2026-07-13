"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { formatDayLabel } from "@/lib/weekSlots";
import Button from "@/components/Button";
import Card from "@/components/Card";

type ActiveMentor = {
  id: string;
  name: string;
  completed: number;
  avgRating: number | null;
};

type RecentSession = {
  id: string;
  studentName: string;
  mentorName: string;
  requested_time: string | null;
  status: string;
  created_at: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const [totalStudents, setTotalStudents] = useState(0);
  const [totalMentors, setTotalMentors] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [sessionsPerDay, setSessionsPerDay] = useState<{ day: string; sessions: number }[]>([]);
  const [topSubjects, setTopSubjects] = useState<{ subject: string; count: number }[]>([]);
  const [activeMentors, setActiveMentors] = useState<ActiveMentor[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  async function loadDashboardData() {
    const [
      { count: totalStudentsCount },
      { count: totalMentorsCount },
      { count: totalSessionsCount },
      { count: completedSessionsCount },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "mentor"),
      supabase.from("sessions").select("*", { count: "exact", head: true }),
      supabase.from("sessions").select("*", { count: "exact", head: true }).eq("status", "completed"),
    ]);

    setTotalStudents(totalStudentsCount ?? 0);
    setTotalMentors(totalMentorsCount ?? 0);
    setTotalSessions(totalSessionsCount ?? 0);
    setCompletionRate(
      totalSessionsCount ? Math.round(((completedSessionsCount ?? 0) / totalSessionsCount) * 100) : 0
    );

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const { data: recentSessionDates } = await supabase
      .from("sessions")
      .select("created_at")
      .gte("created_at", sevenDaysAgo.toISOString());

    const dayBuckets: { date: Date; label: string; sessions: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      dayBuckets.push({ date: d, label: formatDayLabel(d), sessions: 0 });
    }
    (recentSessionDates ?? []).forEach((s) => {
      const sessionDate = new Date(s.created_at);
      sessionDate.setHours(0, 0, 0, 0);
      const bucket = dayBuckets.find((b) => b.date.getTime() === sessionDate.getTime());
      if (bucket) bucket.sessions += 1;
    });
    setSessionsPerDay(dayBuckets.map((b) => ({ day: b.label, sessions: b.sessions })));

    const { data: studentSubjectsData } = await supabase
      .from("profiles")
      .select("subjects")
      .eq("role", "student");

    const subjectCounts: Record<string, number> = {};
    (studentSubjectsData ?? []).forEach((p) => {
      (p.subjects ?? []).forEach((subject: string) => {
        subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
      });
    });
    setTopSubjects(
      Object.entries(subjectCounts)
        .map(([subject, count]) => ({ subject, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    );

    const { data: mentorProfiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("role", "mentor");

    const { data: completedMentorSessions } = await supabase
      .from("sessions")
      .select("mentor_id")
      .eq("status", "completed");

    const { data: mentorRatingData } = await supabase
      .from("sessions")
      .select("mentor_id, rating")
      .not("rating", "is", null);

    const completedCounts: Record<string, number> = {};
    (completedMentorSessions ?? []).forEach((s) => {
      completedCounts[s.mentor_id] = (completedCounts[s.mentor_id] || 0) + 1;
    });

    const mentorsWithStats: ActiveMentor[] = (mentorProfiles ?? []).map((m) => {
      const ratings = (mentorRatingData ?? [])
        .filter((r) => r.mentor_id === m.id)
        .map((r) => r.rating as number);
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : null;

      return {
        id: m.id,
        name: m.display_name || "Unnamed mentor",
        completed: completedCounts[m.id] || 0,
        avgRating,
      };
    });

    setActiveMentors(
      mentorsWithStats.sort((a, b) => b.completed - a.completed).slice(0, 5)
    );

    const { data: recentSessionsData } = await supabase
      .from("sessions")
      .select("id, requested_time, status, created_at, student:profiles!sessions_student_id_fkey(display_name), mentor:profiles!sessions_mentor_id_fkey(display_name)")
      .order("created_at", { ascending: false })
      .limit(10);

    setRecentSessions(
      (recentSessionsData ?? []).map((s) => {
        const student = Array.isArray(s.student) ? s.student[0] ?? null : s.student;
        const mentor = Array.isArray(s.mentor) ? s.mentor[0] ?? null : s.mentor;
        return {
          id: s.id,
          studentName: student?.display_name || "Unknown student",
          mentorName: mentor?.display_name || "Unknown mentor",
          requested_time: s.requested_time,
          status: s.status,
          created_at: s.created_at,
        };
      })
    );
  }

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

        await loadDashboardData();

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
        <Button
          variant="secondary"
          onClick={() => { setLoadError(false); setLoading(true); setRetryCount((c) => c + 1); }}
        >
          Retry
        </Button>
      </div>
    </main>
  );

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Card>
          <div className="text-lg font-semibold">Admin Dashboard</div>
          <p className="mt-2 text-sm text-zinc-600">
            Manage users and oversee platform activity.
          </p>
        </Card>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <div className="text-xs text-zinc-500">Total Students</div>
            <div className="mt-1 text-2xl font-semibold">{totalStudents}</div>
          </Card>
          <Card>
            <div className="text-xs text-zinc-500">Total Mentors</div>
            <div className="mt-1 text-2xl font-semibold">{totalMentors}</div>
          </Card>
          <Card>
            <div className="text-xs text-zinc-500">Total Sessions</div>
            <div className="mt-1 text-2xl font-semibold">{totalSessions}</div>
          </Card>
          <Card>
            <div className="text-xs text-zinc-500">Completion Rate</div>
            <div className="mt-1 text-2xl font-semibold">{completionRate}%</div>
          </Card>
        </div>

        <Card className="mt-4">
          <div className="text-base font-semibold">Sessions Per Day (Last 7 Days)</div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sessionsPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="sessions" stroke="#4f46e5" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="mt-4">
          <div className="text-base font-semibold">Top 5 Subjects Requested</div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSubjects}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="mt-4">
          <div className="text-base font-semibold">Most Active Mentors</div>
          <div className="mt-2 space-y-2 text-sm text-zinc-700">
            {activeMentors.length === 0 ? (
              <p>No mentor activity yet.</p>
            ) : (
              activeMentors.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded border p-3">
                  <div className="font-medium">{m.name}</div>
                  <div className="flex items-center gap-4 text-xs text-zinc-600">
                    <span>{m.completed} completed</span>
                    <span>{m.avgRating ? `${m.avgRating.toFixed(1)}/5` : "No ratings"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="mt-4">
          <div className="text-base font-semibold">Recent Sessions</div>
          <div className="mt-2 space-y-2 text-sm text-zinc-700">
            {recentSessions.length === 0 ? (
              <p>No sessions yet.</p>
            ) : (
              recentSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded border p-3">
                  <div>
                    <div><span className="font-medium">Student:</span> {s.studentName}</div>
                    <div><span className="font-medium">Mentor:</span> {s.mentorName}</div>
                    <div><span className="font-medium">Time slot:</span> {s.requested_time || "Not selected"}</div>
                    <div><span className="font-medium">Date:</span> {new Date(s.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.status === "requested" ? "bg-yellow-100 text-yellow-800" :
                    s.status === "confirmed" ? "bg-green-100 text-green-800" :
                    s.status === "completed" ? "bg-indigo-100 text-indigo-800" :
                    "bg-red-100 text-red-800"
                  }`}>
                    {s.status === "requested" ? "Pending" :
                     s.status === "confirmed" ? "Confirmed" :
                     s.status === "completed" ? "Completed" :
                     "Declined"}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
