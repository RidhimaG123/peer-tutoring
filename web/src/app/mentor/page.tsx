"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, LogOut, Star } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/Button";
import Card from "@/components/Card";

type Section = "feed" | "my-sessions" | "profile";
type SessionsTab = "requests" | "confirmed" | "declined";

const NAV_ITEMS: { key: Section; label: string }[] = [
  { key: "feed", label: "Feed" },
  { key: "my-sessions", label: "My Sessions" },
];

const DARK_CARD = "!bg-zinc-900 !border-zinc-800 !text-white";
const DARK_SECONDARY_BUTTON = "!border-zinc-700 !text-white hover:!bg-zinc-800";

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatMeetingType(value: string | null): string {
  if (value === "online") return "Online";
  if (value === "in-person") return "In person";
  return "Not specified";
}

type SessionRequest = {
  id: string;
  student_id: string;
  status: string;
  created_at: string;
  requested_time: string | null;
  meeting_type: string | null;
  subject: string | null;
  student: {
    display_name: string | null;
    bio: string | null;
    subjects: string[] | null;
    grade: string | null;
  } | null;
};

export default function MentorDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  async function handleAcceptSession(sessionId: string) {
    await supabase
      .from("sessions")
      .update({ status: "confirmed" })
      .eq("id", sessionId);

    window.location.reload();
  }
  async function handleDeclineSession(sessionId: string) {
    try {
      const { error } = await supabase
        .from("sessions")
        .update({ status: "declined" })
        .eq("id", sessionId);

      if (error) {
        console.error("decline session error", error);
        return;
      }

      setRequests((prev) => prev.map((r) => (r.id === sessionId ? { ...r, status: "declined" } : r)));
    } catch (err) {
      console.error("decline session threw", err);
    }
  }
  async function handleCompleteSession(sessionId: string) {
    await supabase
      .from("sessions")
      .update({ status: "completed" })
      .eq("id", sessionId);

    window.location.reload();
  }

  async function handleSave() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) return;

    await supabase
      .from("profiles")
      .update({
        display_name: nameInput,
        headline: headlineInput,
        subjects: subjectsInput.split(",").map(s => s.trim()),
        bio: bioInput,
        availability_preference: availabilityInput
      })
      .eq("id", session.user.id);

    window.location.reload();
  }

  const [nameInput, setNameInput] = useState("");
  const [headlineInput, setHeadlineInput] = useState("");
  const [subjectsInput, setSubjectsInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [availabilityInput, setAvailabilityInput] = useState("");
  const [requests, setRequests] = useState<SessionRequest[]>([]);
  const [mentorId, setMentorId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("my-sessions");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; message: string; created_at: string }[]>([]);
  const [sessionsTab, setSessionsTab] = useState<SessionsTab>("requests");
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [studentFeedback, setStudentFeedback] = useState<{ rating: number; feedback: string | null }[]>([]);
  const [loadingStudentFeedback, setLoadingStudentFeedback] = useState(false);
  const [rescheduleClickedIds, setRescheduleClickedIds] = useState<string[]>([]);

  async function loadSessionRequests(mentorId: string) {
    const { data: sessionRequests } = await supabase
      .from("sessions")
      .select("id, student_id, status, created_at, requested_time, meeting_type, subject, student:profiles!sessions_student_id_fkey(display_name, bio, subjects, grade)")
      .in("status", ["requested", "confirmed", "declined"])
      .eq("mentor_id", mentorId)
      .order("created_at", { ascending: false });

    setRequests((sessionRequests ?? []).map(r => ({ ...r, student: Array.isArray(r.student) ? r.student[0] ?? null : r.student })));
  }

  async function loadStudentFeedback(studentId: string) {
    setLoadingStudentFeedback(true);
    try {
      const { data } = await supabase
        .from("sessions")
        .select("mentor_rating_of_student, mentor_feedback_of_student")
        .eq("student_id", studentId)
        .not("mentor_rating_of_student", "is", null)
        .order("created_at", { ascending: false })
        .limit(3);

      setStudentFeedback((data ?? []).map((d) => ({
        rating: d.mentor_rating_of_student as number,
        feedback: d.mentor_feedback_of_student as string | null,
      })));
    } finally {
      setLoadingStudentFeedback(false);
    }
  }

  function handleToggleStudent(studentId: string) {
    if (expandedStudentId === studentId) {
      setExpandedStudentId(null);
      return;
    }
    setExpandedStudentId(studentId);
    loadStudentFeedback(studentId);
  }

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
        .select("role, display_name, headline, bio, subjects, availability_preference")
        .eq("id", session.user.id)
        .single();
      if (profile?.role !== "mentor") {
        router.replace("/");
        return;
      }

      if (profile) {
        setNameInput(profile.display_name || "");
        setHeadlineInput(profile.headline || "");
        setSubjectsInput(profile.subjects?.join(", ") || "");
        setBioInput(profile.bio || "");
        setAvailabilityInput(profile.availability_preference || "");
      }

      setMentorId(session.user.id);
      await loadSessionRequests(session.user.id);

      const { data: notificationsData } = await supabase
        .from("notifications")
        .select("id, message, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      setNotifications(notificationsData ?? []);

      setLoading(false);
    }

    checkAccess();
  }, [router]);

  useEffect(() => {
    function handleFocus() {
      if (mentorId) {
        loadSessionRequests(mentorId);
      }
    }

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [mentorId]);

  if (loading) return null;

  async function handleLogout() {
    await supabase.auth.signOut();
    setTimeout(() => { window.location.href = "/"; }, 500);
  }

  const requestedSessions = requests.filter((r) => r.status === "requested");
  const confirmedSessions = requests.filter((r) => r.status === "confirmed");
  const declinedSessions = requests.filter((r) => r.status === "declined");

  const sidebarNav = (onNavigate?: () => void) => (
    <>
      <div className="px-5 py-5 text-lg font-semibold text-white">PeerPrep</div>
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
          onClick={() => { setActiveSection("profile"); onNavigate?.(); }}
          className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
            activeSection === "profile" ? "bg-indigo-600 text-white" : "text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          Profile
        </button>
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
          <div className="text-lg font-semibold">PeerPrep</div>
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

        <div className="mx-auto max-w-3xl px-4 py-10">
          {activeSection === "feed" && (
            <Card className={DARK_CARD}>
              <div className="text-base font-semibold">Feed</div>
              {notifications.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-400">Nothing here yet. Check back after your first session.</p>
              ) : (
                <div className="mt-2 space-y-2 text-sm text-zinc-400">
                  {notifications.map((n) => (
                    <div key={n.id} className="flex items-center justify-between gap-3 rounded border border-zinc-800 p-3">
                      <span>{n.message}</span>
                      <span className="shrink-0 text-xs text-zinc-500">{formatRelativeTime(n.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeSection === "my-sessions" && (
            <Card className={DARK_CARD}>
              <div className="text-base font-semibold">My Sessions</div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant={sessionsTab === "requests" ? "primary" : "secondary"}
                  onClick={() => setSessionsTab("requests")}
                  className={`!px-3 !py-1.5 !text-xs ${sessionsTab === "requests" ? "" : DARK_SECONDARY_BUTTON}`}
                >
                  New Requests
                </Button>
                <Button
                  variant={sessionsTab === "confirmed" ? "primary" : "secondary"}
                  onClick={() => setSessionsTab("confirmed")}
                  className={`!px-3 !py-1.5 !text-xs ${sessionsTab === "confirmed" ? "" : DARK_SECONDARY_BUTTON}`}
                >
                  Confirmed
                </Button>
                <Button
                  variant={sessionsTab === "declined" ? "primary" : "secondary"}
                  onClick={() => setSessionsTab("declined")}
                  className={`!px-3 !py-1.5 !text-xs ${sessionsTab === "declined" ? "" : DARK_SECONDARY_BUTTON}`}
                >
                  Declined
                </Button>
              </div>

              <div className="mt-4 space-y-2 text-sm text-zinc-400">
                {sessionsTab === "requests" && (
                  requestedSessions.length === 0 ? (
                    <p>No pending session requests.</p>
                  ) : (
                    requestedSessions.map((request) => (
                      <div key={request.id} className="rounded border border-zinc-800 p-3">
                        <button
                          type="button"
                          onClick={() => handleToggleStudent(request.student_id)}
                          className="text-sm font-medium text-white hover:text-indigo-400"
                        >
                          {request.student?.display_name || "Unnamed student"}
                        </button>
                        <div className="mt-1 space-y-0.5">
                          <div><span className="text-zinc-500">Year group:</span> {request.student?.grade || "Not set"}</div>
                          <div><span className="text-zinc-500">Subjects:</span> {request.student?.subjects?.join(", ") || "Not set"}</div>
                          <div><span className="text-zinc-500">Time slot:</span> {request.requested_time || "Not selected"}</div>
                          <div><span className="text-zinc-500">Meeting type:</span> {formatMeetingType(request.meeting_type)}</div>
                        </div>

                        {expandedStudentId === request.student_id && (
                          <div className="mt-2 rounded border border-zinc-800 bg-zinc-800 p-3">
                            <div className="text-sm font-medium text-white">{request.student?.display_name || "Unnamed student"}</div>
                            <div className="mt-1 text-xs">
                              <div><span className="text-zinc-500">Year group:</span> {request.student?.grade || "Not set"}</div>
                              <div><span className="text-zinc-500">Subjects:</span> {request.student?.subjects?.join(", ") || "Not set"}</div>
                            </div>
                            <div className="mt-2 text-xs font-medium text-zinc-500">Feedback from other mentors</div>
                            {loadingStudentFeedback ? (
                              <p className="mt-1 text-xs">Loading...</p>
                            ) : studentFeedback.length === 0 ? (
                              <p className="mt-1 text-xs">No feedback yet.</p>
                            ) : (
                              <div className="mt-1 space-y-1">
                                {studentFeedback.map((f, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <div className="flex gap-0.5">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                          key={star}
                                          size={12}
                                          className={star <= f.rating ? "text-yellow-400" : "text-zinc-600"}
                                          fill={star <= f.rating ? "currentColor" : "none"}
                                        />
                                      ))}
                                    </div>
                                    {f.feedback && <span>{f.feedback}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-2 flex gap-2">
                          <Button variant="accent" onClick={() => handleAcceptSession(request.id)} className="!px-3 !py-1 !text-xs">Accept</Button>
                          <Button variant="secondary" onClick={() => handleDeclineSession(request.id)} className={`!px-3 !py-1 !text-xs ${DARK_SECONDARY_BUTTON}`}>Decline</Button>
                        </div>
                      </div>
                    ))
                  )
                )}

                {sessionsTab === "confirmed" && (
                  confirmedSessions.length === 0 ? (
                    <p>No confirmed sessions.</p>
                  ) : (
                    confirmedSessions.map((request) => (
                      <div key={request.id} className="rounded border border-zinc-800 p-3">
                        <div className="text-sm font-medium text-white">{request.student?.display_name || "Unnamed student"}</div>
                        <div className="mt-1 space-y-0.5">
                          <div><span className="text-zinc-500">Subject:</span> {request.subject || "Not specified"}</div>
                          <div><span className="text-zinc-500">Time slot:</span> {request.requested_time || "Not selected"}</div>
                          <div><span className="text-zinc-500">Meeting type:</span> {formatMeetingType(request.meeting_type)}</div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button onClick={() => handleCompleteSession(request.id)} className="!px-3 !py-1 !text-xs">Mark complete</Button>
                          <Button
                            variant="secondary"
                            onClick={() => setRescheduleClickedIds((prev) => [...prev, request.id])}
                            className={`!px-3 !py-1 !text-xs ${DARK_SECONDARY_BUTTON}`}
                          >
                            Reschedule
                          </Button>
                        </div>
                        {rescheduleClickedIds.includes(request.id) && (
                          <p className="mt-2 text-xs text-zinc-500">Reschedule coming soon</p>
                        )}
                      </div>
                    ))
                  )
                )}

                {sessionsTab === "declined" && (
                  declinedSessions.length === 0 ? (
                    <p>No declined sessions.</p>
                  ) : (
                    declinedSessions.map((request) => (
                      <div key={request.id} className="rounded border border-zinc-800 p-3">
                        <div className="text-sm font-medium text-white">{request.student?.display_name || "Unnamed student"}</div>
                        <div className="mt-1 space-y-0.5">
                          <div><span className="text-zinc-500">Subject:</span> {request.subject || "Not specified"}</div>
                          <div><span className="text-zinc-500">Time slot:</span> {request.requested_time || "Not selected"}</div>
                          <div><span className="text-zinc-500">Date declined:</span> {new Date(request.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </Card>
          )}

          {activeSection === "profile" && (
            <Card className={DARK_CARD}>
              <div className="text-base font-semibold">Edit Profile</div>
              <div className="mt-2 space-y-2">
                <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-sm text-white placeholder:text-zinc-500" placeholder="Name" />
                <input value={headlineInput} onChange={(e) => setHeadlineInput(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-sm text-white placeholder:text-zinc-500" placeholder="Headline" />
                <input value={subjectsInput} onChange={(e) => setSubjectsInput(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-sm text-white placeholder:text-zinc-500" placeholder="Subjects (comma separated)" />
                <textarea value={bioInput} onChange={(e) => setBioInput(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-sm text-white placeholder:text-zinc-500" placeholder="Bio" />
                <input value={availabilityInput} onChange={(e) => setAvailabilityInput(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-sm text-white placeholder:text-zinc-500" placeholder="Availability" />
                <Button onClick={handleSave} className="mt-2">Save</Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
