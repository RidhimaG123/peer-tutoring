"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
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

type Section = "overview" | "users" | "sessions" | "notifications";

const NAV_ITEMS: { key: Section; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "users", label: "Users" },
  { key: "sessions", label: "Sessions" },
  { key: "notifications", label: "Notifications" },
];

const DARK_CARD = "!bg-zinc-900 !border-zinc-800 !text-white";
const DARK_SECONDARY_BUTTON = "!border-zinc-700 !text-white hover:!bg-zinc-800";
const CHART_GRID_COLOR = "#27272a";
const CHART_TICK = { fontSize: 12, fill: "#a1a1aa" };
const CHART_TOOLTIP_STYLE = { backgroundColor: "#18181b", border: "1px solid #3f3f46", color: "#fff" };

const STATUS_FILTERS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "Requested", value: "requested" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "Declined", value: "declined" },
];

type ActiveMentor = {
  id: string;
  name: string;
  grade: string | null;
  completed: number;
  avgRating: number | null;
};

type UserRow = {
  id: string;
  display_name: string | null;
  role: string;
  grade: string | null;
  email: string | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  studentName: string;
  mentorName: string;
  subject: string | null;
  requested_time: string | null;
  meeting_type: string | null;
  status: string;
  created_at: string;
};

type NotificationRow = {
  id: string;
  message: string;
  type: string | null;
  created_at: string;
};

function formatMeetingType(value: string | null): string {
  if (value === "online") return "Online";
  if (value === "in-person") return "In person";
  return "Not specified";
}

function formatAudience(type: string | null): string {
  if (type === "admin_broadcast_students") return "All students";
  if (type === "admin_broadcast_mentors") return "All mentors";
  if (type === "admin_broadcast_everyone") return "Everyone";
  return "—";
}

function roleBadgeClass(role: string): string {
  if (role === "mentor") return "bg-green-100 text-green-800";
  if (role === "admin") return "bg-red-100 text-red-800";
  return "bg-indigo-100 text-indigo-800";
}

function statusBadgeClass(status: string): string {
  if (status === "confirmed") return "bg-green-100 text-green-800";
  if (status === "completed") return "bg-indigo-100 text-indigo-800";
  if (status === "declined") return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800";
}

function statusLabel(status: string): string {
  if (status === "requested") return "Pending";
  if (status === "confirmed") return "Confirmed";
  if (status === "completed") return "Completed";
  return "Declined";
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [totalStudents, setTotalStudents] = useState(0);
  const [totalMentors, setTotalMentors] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [sessionsPerDay, setSessionsPerDay] = useState<{ day: string; sessions: number }[]>([]);
  const [topSubjects, setTopSubjects] = useState<{ subject: string; count: number }[]>([]);
  const [activeMentors, setActiveMentors] = useState<ActiveMentor[]>([]);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = useState("");

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [notificationTarget, setNotificationTarget] = useState<"students" | "mentors" | "everyone">("students");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState("");

  async function loadOverviewData() {
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

    const { data: mentorSubjectsData } = await supabase
      .from("profiles")
      .select("subjects")
      .eq("role", "mentor");

    const subjectCounts: Record<string, number> = {};
    [...(studentSubjectsData ?? []), ...(mentorSubjectsData ?? [])].forEach((p) => {
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
      .select("id, display_name, grade")
      .eq("role", "mentor");

    const { data: completedMentorSessions } = await supabase
      .from("sessions")
      .select("mentor_id")
      .eq("status", "completed");

    const { data: mentorRatingData } = await supabase
      .from("sessions")
      .select("mentor_id, student_rating_of_mentor")
      .not("student_rating_of_mentor", "is", null);

    const completedCounts: Record<string, number> = {};
    (completedMentorSessions ?? []).forEach((s) => {
      completedCounts[s.mentor_id] = (completedCounts[s.mentor_id] || 0) + 1;
    });

    const mentorsWithStats: ActiveMentor[] = (mentorProfiles ?? []).map((m) => {
      const ratings = (mentorRatingData ?? [])
        .filter((r) => r.mentor_id === m.id)
        .map((r) => r.student_rating_of_mentor as number);
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : null;

      return {
        id: m.id,
        name: m.display_name || "Unnamed mentor",
        grade: m.grade,
        completed: completedCounts[m.id] || 0,
        avgRating,
      };
    });

    setActiveMentors(
      mentorsWithStats.sort((a, b) => b.completed - a.completed).slice(0, 5)
    );
  }

  async function loadUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, role, grade, email, created_at")
      .order("created_at", { ascending: false });

    setUsers(data ?? []);
  }

  async function loadSessions() {
    const { data } = await supabase
      .from("sessions")
      .select("id, subject, requested_time, meeting_type, status, created_at, student:profiles!sessions_student_id_fkey(display_name), mentor:profiles!sessions_mentor_id_fkey(display_name)")
      .order("created_at", { ascending: false });

    setSessions(
      (data ?? []).map((s) => {
        const student = Array.isArray(s.student) ? s.student[0] ?? null : s.student;
        const mentor = Array.isArray(s.mentor) ? s.mentor[0] ?? null : s.mentor;
        return {
          id: s.id,
          studentName: student?.display_name || "Unknown student",
          mentorName: mentor?.display_name || "Unknown mentor",
          subject: s.subject,
          requested_time: s.requested_time,
          meeting_type: s.meeting_type,
          status: s.status,
          created_at: s.created_at,
        };
      })
    );
  }

  async function loadNotifications() {
    const { data } = await supabase
      .from("notifications")
      .select("id, message, type, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    setNotifications(data ?? []);
  }

  async function handleSendNotification(e: React.FormEvent) {
    e.preventDefault();
    if (!notificationMessage.trim()) return;

    setSendingNotification(true);
    setNotificationStatus("");
    try {
      let recipientQuery = supabase.from("profiles").select("id");
      if (notificationTarget === "students") {
        recipientQuery = recipientQuery.eq("role", "student");
      } else if (notificationTarget === "mentors") {
        recipientQuery = recipientQuery.eq("role", "mentor");
      }

      const { data: recipients, error: recipientsError } = await recipientQuery;

      if (recipientsError || !recipients || recipients.length === 0) {
        setNotificationStatus(recipientsError ? "Error loading recipients." : "No matching users found.");
        return;
      }

      const type = `admin_broadcast_${notificationTarget}`;
      const rows = recipients.map((r) => ({
        user_id: r.id,
        type,
        message: notificationMessage.trim(),
      }));

      const { error: insertError } = await supabase.from("notifications").insert(rows);

      if (insertError) {
        console.error("send notification error", insertError);
        setNotificationStatus("Error sending notification.");
        return;
      }

      setNotificationMessage("");
      setNotificationStatus(`Notification sent to ${rows.length} user${rows.length === 1 ? "" : "s"}.`);
      await loadNotifications();
    } finally {
      setSendingNotification(false);
    }
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

        await Promise.all([loadOverviewData(), loadUsers(), loadSessions(), loadNotifications()]);

        setLoading(false);
      } catch (err) {
        console.error("dashboard load error", err);
        setLoadError(true);
        setLoading(false);
      }
    }

    checkAccess();
  }, [router, retryCount]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setTimeout(() => { window.location.href = "/"; }, 500);
  }

  if (loading) return (
    <main className="min-h-dvh bg-zinc-950 flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
        <p className="text-sm text-zinc-400">Loading...</p>
      </div>
    </main>
  );

  if (loadError) return (
    <main className="min-h-dvh bg-zinc-950 flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-zinc-400">Something went wrong loading your dashboard.</p>
        <Button
          variant="secondary"
          onClick={() => { setLoadError(false); setLoading(true); setRetryCount((c) => c + 1); }}
          className={DARK_SECONDARY_BUTTON}
        >
          Retry
        </Button>
      </div>
    </main>
  );

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const query = userSearch.toLowerCase();
    return (u.display_name || "").toLowerCase().includes(query) || (u.email || "").toLowerCase().includes(query);
  });

  const filteredSessions = sessions.filter((s) => !statusFilter || s.status === statusFilter);

  const sidebarNav = (onNavigate?: () => void) => (
    <>
      <div className="px-5 py-5 text-lg font-semibold text-white">PeerPrep Admin</div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => { setActiveSection(item.key); onNavigate?.(); }}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              activeSection === item.key ? "bg-indigo-600 text-white" : "text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="space-y-1 px-3 pb-5">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
        >
          <LogOut size={14} /> Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden md:flex md:w-56 md:flex-col md:bg-zinc-900">
        {sidebarNav()}
      </aside>

      <div className="flex-1 bg-zinc-950 text-white">
        <div className="flex items-center justify-between bg-zinc-900 px-4 py-3 text-white md:hidden">
          <div className="text-lg font-semibold">PeerPrep Admin</div>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen((open) => !open)}
            aria-label="Toggle menu"
          >
            {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileSidebarOpen && (
          <div className="flex flex-col bg-zinc-900 md:hidden">
            {sidebarNav(() => setMobileSidebarOpen(false))}
          </div>
        )}

        <div className="mx-auto max-w-5xl px-4 py-10">
          {activeSection === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card className={DARK_CARD}>
                  <div className="text-xs text-zinc-400">Total Students</div>
                  <div className="mt-1 text-2xl font-semibold">{totalStudents}</div>
                </Card>
                <Card className={DARK_CARD}>
                  <div className="text-xs text-zinc-400">Total Mentors</div>
                  <div className="mt-1 text-2xl font-semibold">{totalMentors}</div>
                </Card>
                <Card className={DARK_CARD}>
                  <div className="text-xs text-zinc-400">Total Sessions</div>
                  <div className="mt-1 text-2xl font-semibold">{totalSessions}</div>
                </Card>
                <Card className={DARK_CARD}>
                  <div className="text-xs text-zinc-400">Completion Rate</div>
                  <div className="mt-1 text-2xl font-semibold">{completionRate}%</div>
                </Card>
              </div>

              <Card className={`${DARK_CARD} mt-4`}>
                <div className="text-base font-semibold">Sessions Per Day (Last 7 Days)</div>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sessionsPerDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                      <XAxis dataKey="day" tick={CHART_TICK} />
                      <YAxis allowDecimals={false} tick={CHART_TICK} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="sessions" stroke="#818cf8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className={`${DARK_CARD} mt-4`}>
                <div className="text-base font-semibold">Top 5 Subjects</div>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topSubjects}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                      <XAxis dataKey="subject" tick={CHART_TICK} />
                      <YAxis allowDecimals={false} tick={CHART_TICK} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className={`${DARK_CARD} mt-4`}>
                <div className="text-base font-semibold">Most Active Mentors</div>
                <div className="mt-2 space-y-2 text-sm text-zinc-400">
                  {activeMentors.length === 0 ? (
                    <p>No mentor activity yet.</p>
                  ) : (
                    activeMentors.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-3 rounded border border-zinc-800 p-3">
                        <div>
                          <div className="font-medium text-white">{m.name}</div>
                          <div className="text-xs text-zinc-500">{m.grade || "Year not set"}</div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span>{m.completed} completed</span>
                          <span>{m.avgRating ? `${m.avgRating.toFixed(1)}/5` : "No ratings"}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </>
          )}

          {activeSection === "users" && (
            <Card className={DARK_CARD}>
              <div className="text-base font-semibold">Users</div>
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name or email"
                className="mt-3 w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-sm text-white placeholder:text-zinc-500"
              />

              <div className="mt-4 space-y-2 text-sm text-zinc-400">
                {filteredUsers.length === 0 ? (
                  <p>No users found.</p>
                ) : (
                  filteredUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-3 rounded border border-zinc-800 p-3">
                      <div>
                        <div className="font-medium text-white">{u.display_name || "Unnamed user"}</div>
                        <div className="text-xs text-zinc-500">{u.email || "No email"}</div>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span>{u.grade || "Not set"}</span>
                        <span>{new Date(u.created_at).toLocaleDateString()}</span>
                        <span className={`rounded-full px-2 py-0.5 font-medium ${roleBadgeClass(u.role)}`}>
                          {u.role}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          {activeSection === "sessions" && (
            <Card className={DARK_CARD}>
              <div className="text-base font-semibold">Sessions</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {STATUS_FILTERS.map((f) => (
                  <Button
                    key={f.label}
                    variant={statusFilter === f.value ? "primary" : "secondary"}
                    onClick={() => setStatusFilter(f.value)}
                    className={`!px-3 !py-1.5 !text-xs ${statusFilter === f.value ? "" : DARK_SECONDARY_BUTTON}`}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>

              <div className="mt-4 space-y-2 text-sm text-zinc-400">
                {filteredSessions.length === 0 ? (
                  <p>No sessions found.</p>
                ) : (
                  filteredSessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 rounded border border-zinc-800 p-3">
                      <div>
                        <div><span className="font-medium text-white">Student:</span> {s.studentName}</div>
                        <div><span className="font-medium text-white">Mentor:</span> {s.mentorName}</div>
                        <div><span className="font-medium text-white">Subject:</span> {s.subject || "Not specified"}</div>
                        <div><span className="font-medium text-white">Time slot:</span> {s.requested_time || "Not selected"}</div>
                        <div><span className="font-medium text-white">Meeting type:</span> {formatMeetingType(s.meeting_type)}</div>
                        <div><span className="font-medium text-white">Date:</span> {new Date(s.created_at).toLocaleDateString()}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(s.status)}`}>
                        {statusLabel(s.status)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          {activeSection === "notifications" && (
            <>
              <Card className={DARK_CARD}>
                <div className="text-base font-semibold">Send a notification</div>
                <form className="mt-3 space-y-3" onSubmit={handleSendNotification}>
                  <label className="block">
                    <div className="text-xs font-medium text-zinc-400">Target</div>
                    <select
                      value={notificationTarget}
                      onChange={(e) => setNotificationTarget(e.target.value as "students" | "mentors" | "everyone")}
                      className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-sm text-white"
                    >
                      <option value="students">All students</option>
                      <option value="mentors">All mentors</option>
                      <option value="everyone">Everyone</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="text-xs font-medium text-zinc-400">Message</div>
                    <textarea
                      value={notificationMessage}
                      onChange={(e) => setNotificationMessage(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-sm text-white placeholder:text-zinc-500"
                      placeholder="Write your message..."
                    />
                  </label>

                  <Button type="submit" disabled={!notificationMessage.trim() || sendingNotification}>
                    {sendingNotification ? "Sending..." : "Send notification"}
                  </Button>

                  {notificationStatus && <p className="text-xs text-zinc-400">{notificationStatus}</p>}
                </form>
              </Card>

              <Card className={`${DARK_CARD} mt-4`}>
                <div className="text-base font-semibold">Recently sent</div>
                <div className="mt-2 space-y-2 text-sm text-zinc-400">
                  {notifications.length === 0 ? (
                    <p>No notifications sent yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="rounded border border-zinc-800 p-3">
                        <div className="text-white">{n.message}</div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                          <span>{formatAudience(n.type)}</span>
                          <span>{new Date(n.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
