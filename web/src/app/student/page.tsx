"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Menu, X, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatDayLabel } from "@/lib/weekSlots";
import Button from "@/components/Button";
import Card from "@/components/Card";
import TimeSlotPicker from "@/components/TimeSlotPicker";

type Section = "feed" | "find-tutor" | "my-sessions" | "mentor-profiles" | "profile";

const NAV_ITEMS: { key: Section; label: string }[] = [
  { key: "feed", label: "Feed" },
  { key: "find-tutor", label: "Find a Tutor" },
  { key: "my-sessions", label: "My Sessions" },
  { key: "mentor-profiles", label: "Mentor Profiles" },
];

const SUBJECTS = [
  { name: "Maths", emoji: "🧮" },
  { name: "English", emoji: "📚" },
  { name: "Economics", emoji: "📈" },
  { name: "Chemistry", emoji: "🧪" },
  { name: "Biology", emoji: "🧬" },
  { name: "Physics", emoji: "⚛️" },
  { name: "Computer Science", emoji: "💻" },
  { name: "Business", emoji: "💼" },
];

const STUDENT_FEEDBACK_TAGS = ["Explained clearly", "Patient", "Came prepared", "Helped me think", "Would book again"];

const DARK_CARD = "!bg-zinc-900 !border-zinc-800 !text-white";
const DARK_BOX = "rounded border border-zinc-800 bg-zinc-800 p-3";
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

function initialsFor(name: string | null | undefined): string {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

type MentorProfile = {
  id: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  subjects: string[] | null;
  grade: string | null;
  average_rating: number | null;
};

type StudentProfile = {
  display_name: string | null;
  grade: string | null;
  bio: string | null;
  subjects: string[] | null;
  availability_preference: string | null;
};

type RatingEntry = {
  mentor_id: string;
  rating: number;
  feedback: string | null;
  student_tags: string[] | null;
  created_at: string;
  student: { display_name: string | null } | null;
};

type BookingConfirmation = {
  mentorId: string;
  mentorName: string;
  subject: string | null;
  slot: string;
  meetingType: string;
};

export default function StudentDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [matchedMentorId, setMatchedMentorId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [gradeInput, setGradeInput] = useState("");
  const [subjectsInput, setSubjectsInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [availabilityInput, setAvailabilityInput] = useState("");
  const [matchHistory, setMatchHistory] = useState<{ mentor_id: string; created_at: string }[]>([]);
  const [bookedSessions, setBookedSessions] = useState<{ id: string; status: string; requested_time: string | null; subject: string | null; created_at: string; mentor_id: string; mentor: { display_name: string | null } | null }[]>([]);
  const [pastSessions, setPastSessions] = useState<{ id: string; requested_time: string | null; subject: string | null; student_rating_of_mentor: number | null; created_at: string; mentor: { display_name: string | null } | null }[]>([]);
  const [notifications, setNotifications] = useState<{ id: string; message: string; created_at: string }[]>([]);
  const [ratingEntries, setRatingEntries] = useState<RatingEntry[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [meetingType, setMeetingType] = useState<"online" | "in-person" | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmation | null>(null);
  const [requestingMentorId, setRequestingMentorId] = useState<string | null>(null);
  const [expandedFeedbackSessionId, setExpandedFeedbackSessionId] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackTags, setFeedbackTags] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackThanksSessionId, setFeedbackThanksSessionId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("my-sessions");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [expandedMentorId, setExpandedMentorId] = useState<string | null>(null);

  async function handleSave() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) return;

    await supabase
      .from("profiles")
      .update({
        display_name: nameInput,
        grade: gradeInput,
        subjects: subjectsInput.split(",").map(s => s.trim()),
        bio: bioInput,
        availability_preference: availabilityInput
      })
      .eq("id", session.user.id);

    // reload page data
    window.location.reload();
  }

  function handleSelectSlot(slot: string) {
    setSelectedTimeSlot(slot);
    setConflictWarning(null);
  }

  async function handleRequestSession(mentorId: string, subject: string | null) {
    if (!mentorId || !selectedTimeSlot || !meetingType) return;

    const conflict = bookedSessions.find(
      (s) => s.requested_time === selectedTimeSlot && (s.status === "requested" || s.status === "confirmed")
    );
    if (conflict) {
      setConflictWarning(
        conflict.status === "confirmed"
          ? "You already have a session booked at this time"
          : "You have a pending request at this time"
      );
      return;
    }

    setRequestingMentorId(mentorId);
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return;

      const { error } = await supabase
        .from("sessions")
        .insert({
          student_id: session.user.id,
          mentor_id: mentorId,
          requested_time: selectedTimeSlot,
          meeting_type: meetingType,
          subject,
          status: "requested",
        });

      if (error) {
        console.error("request session error", error);
        return;
      }

      const bookedMentor = mentors.find((m) => m.id === mentorId);
      setBookingConfirmation({
        mentorId,
        mentorName: bookedMentor?.display_name || "Unnamed mentor",
        subject,
        slot: selectedTimeSlot,
        meetingType: meetingType === "in-person" ? "In person" : "Online",
      });
      setExpandedMentorId(null);
      setConflictWarning(null);

      try {
        const studentEmail = session.user.email ?? "";
        const studentName = profile?.display_name ?? "";
        const slot = selectedTimeSlot;
        if (studentEmail) {
          await fetch("/api/send-confirmation", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ studentEmail, studentName, mentorId, slot }),
          });
        }
      } catch (emailErr) {
        console.error("email send error (non-fatal):", emailErr);
      }
    } finally {
      setRequestingMentorId(null);
    }
  }

  function toggleFeedbackTag(tag: string) {
    setFeedbackTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function handleOpenFeedback(sessionId: string) {
    setExpandedFeedbackSessionId(sessionId);
    setFeedbackRating(null);
    setFeedbackTags([]);
    setFeedbackComment("");
  }

  async function handleSubmitFeedback(sessionId: string) {
    if (!feedbackRating) return;

    setSubmittingFeedback(true);
    try {
      const { error } = await supabase
        .from("sessions")
        .update({
          student_rating_of_mentor: feedbackRating,
          student_tags: feedbackTags,
          feedback: feedbackComment.trim() || null,
        })
        .eq("id", sessionId);

      if (error) {
        console.error("submit feedback error", error);
        return;
      }

      setExpandedFeedbackSessionId(null);
      setFeedbackThanksSessionId(sessionId);
      setTimeout(() => window.location.reload(), 1500);
    } finally {
      setSubmittingFeedback(false);
    }
  }

  async function handleRematch() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    await supabase
      .from("matches")
      .delete()
      .eq("student_id", session.user.id)
      .gte("created_at", todayStart.toISOString());

    await runMatching(session.user.id, profile?.subjects ?? null);
    window.location.reload();
  }

  async function runMatching(studentId: string, studentSubjects: string[] | null) {
    if (!studentSubjects || studentSubjects.length === 0) return;

    const { data: mentorMatches } = await supabase
      .from("profiles")
      .select("id, subjects")
      .eq("role", "mentor");

    const matchedMentor = mentorMatches
      ?.map((mentor) => ({
        ...mentor,
        overlapCount: mentor.subjects?.filter((subject: string) =>
          studentSubjects.includes(subject)
        ).length ?? 0
      }))
      .filter((mentor) => mentor.overlapCount > 0)
      .sort((a, b) => b.overlapCount - a.overlapCount)[0];

    if (!matchedMentor) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: existingMatch } = await supabase
      .from("matches")
      .select("id")
      .eq("student_id", studentId)
      .eq("status", "active")
      .gte("created_at", todayStart.toISOString())
      .maybeSingle();

    if (existingMatch) return;

    await supabase
      .from("matches")
      .insert({
        student_id: studentId,
        mentor_id: matchedMentor.id,
        status: "active"
      });
  }


  useEffect(() => {
    async function checkAccess() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;

        if (!session) {
          setLoading(false);
          router.replace("/auth");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, display_name, grade, bio, subjects, availability_preference")
          .eq("id", session.user.id)
          .single();

        setProfile(profile);

        if (profile) {
          setNameInput(profile.display_name || "");
          setGradeInput(profile.grade || "");
          setSubjectsInput(profile.subjects?.join(", ") || "");
          setBioInput(profile.bio || "");
          setAvailabilityInput(profile.availability_preference || "");
        }
        if (profile) {
          await runMatching(session.user.id, profile.subjects);
        }



        if (profile?.role !== "student") {
          setLoading(false);
          router.replace("/");
          return;
        }

        const { data: matchData } = await supabase
          .from("matches")
          .select("mentor_id")
          .eq("student_id", session.user.id)
          .maybeSingle();

        setMatchedMentorId(matchData?.mentor_id ?? null);

        const { data: historyData } = await supabase
          .from("matches")
          .select("mentor_id, created_at")
          .eq("student_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(7);

        setMatchHistory(historyData ?? []);

        const { data: pastSessionsData } = await supabase
          .from("sessions")
          .select("id, requested_time, subject, student_rating_of_mentor, created_at, mentor:profiles!sessions_mentor_id_fkey(display_name)")
          .eq("student_id", session.user.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false });

        setPastSessions((pastSessionsData ?? []).map((s) => ({
          ...s,
          mentor: Array.isArray(s.mentor) ? s.mentor[0] ?? null : s.mentor,
        })));

        const { data: notificationsData } = await supabase
          .from("notifications")
          .select("id, message, created_at")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        setNotifications(notificationsData ?? []);

        const { data: ratingData } = await supabase
          .from("sessions")
          .select("mentor_id, student_rating_of_mentor, feedback, student_tags, created_at, student:profiles!sessions_student_id_fkey(display_name)")
          .not("student_rating_of_mentor", "is", null)
          .order("created_at", { ascending: false });

        const normalizedRatingEntries = (ratingData ?? []).map((r) => ({
          mentor_id: r.mentor_id,
          rating: r.student_rating_of_mentor as number,
          feedback: r.feedback,
          student_tags: r.student_tags,
          created_at: r.created_at,
          student: Array.isArray(r.student) ? r.student[0] ?? null : r.student,
        })) as RatingEntry[];

        setRatingEntries(normalizedRatingEntries);

        const { data: bookedSessionsData } = await supabase
          .from("sessions")
          .select("id, status, requested_time, subject, created_at, mentor_id, mentor:profiles!sessions_mentor_id_fkey(display_name)")
          .eq("student_id", session.user.id)
          .in("status", ["requested", "confirmed", "declined"])
          .order("created_at", { ascending: false });

        setBookedSessions((bookedSessionsData ?? []).map((s) => ({
          ...s,
          mentor: Array.isArray(s.mentor) ? s.mentor[0] ?? null : s.mentor,
        })));


        const { data: mentorsData } = await supabase
          .from("profiles")
          .select("id, display_name, headline, bio, subjects, grade")
          .eq("role", "mentor")
          .order("created_at", { ascending: false });

        const mentorsWithRatings = (mentorsData ?? []).map((mentor) => {
          const mentorRatings = normalizedRatingEntries
            .filter((r) => r.mentor_id === mentor.id)
            .map((r) => r.rating);

          const average_rating = mentorRatings.length > 0
            ? mentorRatings.reduce((sum, rating) => sum + rating, 0) / mentorRatings.length
            : null;

          return { ...mentor, average_rating };
        });

        setMentors(mentorsWithRatings);
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [router]);

  if (loading) return null;

  const matchedMentor = mentors.find((mentor) => mentor.id === matchedMentorId) ?? null;

  const todayLabel = formatDayLabel(new Date());
  const confirmedSessionToday = matchedMentor
    ? bookedSessions.find((s) =>
        s.mentor_id === matchedMentor.id &&
        s.status === "confirmed" &&
        s.requested_time?.startsWith(todayLabel)
      )
    : undefined;

  const subjectMentors = selectedSubject
    ? mentors.filter((mentor) => mentor.subjects?.includes(selectedSubject))
    : [];

  async function handleLogout() {
    await supabase.auth.signOut();
    setTimeout(() => { window.location.href = "/"; }, 500);
  }

  function renderMeetingTypeStep() {
    return (
      <div>
        <div className="text-sm text-zinc-400">How do you want to meet?</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMeetingType("online")}
            className={`rounded-xl border p-3 text-sm font-medium transition-colors ${
              meetingType === "online" ? "border-indigo-500 bg-indigo-600 text-white" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            Online
          </button>
          <button
            type="button"
            onClick={() => setMeetingType("in-person")}
            className={`rounded-xl border p-3 text-sm font-medium transition-colors ${
              meetingType === "in-person" ? "border-indigo-500 bg-indigo-600 text-white" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            In person
          </button>
        </div>
      </div>
    );
  }

  function renderBookingConfirmation(confirmation: BookingConfirmation) {
    return (
      <div className={`mt-3 space-y-2 ${DARK_BOX}`}>
        <p className="font-medium text-white">Your request has been sent. The mentor will accept or decline shortly.</p>
        <div className="space-y-1 text-sm text-zinc-400">
          <div><span className="text-zinc-500">Mentor:</span> {confirmation.mentorName}</div>
          <div><span className="text-zinc-500">Subject:</span> {confirmation.subject || "Not selected"}</div>
          <div><span className="text-zinc-500">Time slot:</span> {confirmation.slot}</div>
          <div><span className="text-zinc-500">Meeting type:</span> {confirmation.meetingType}</div>
        </div>
        <Button onClick={() => window.location.reload()} className="mt-2">Done</Button>
      </div>
    );
  }

  function renderMentorBookingCard(mentor: MentorProfile) {
    const initials = initialsFor(mentor.display_name);
    const roundedRating = Math.round(mentor.average_rating ?? 0);
    const isExpanded = expandedMentorId === mentor.id;
    const confirmation = bookingConfirmation?.mentorId === mentor.id ? bookingConfirmation : null;

    return (
      <div key={mentor.id} className="rounded-xl border border-zinc-800 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">{mentor.display_name || "Unnamed mentor"}</div>
            <div className="mt-0.5 text-sm text-zinc-400">{mentor.grade || "Year not set"}</div>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={14}
                  className={star <= roundedRating ? "text-yellow-400" : "text-zinc-600"}
                  fill={star <= roundedRating ? "currentColor" : "none"}
                />
              ))}
              <span className="ml-1 text-xs text-zinc-500">
                {mentor.average_rating ? `${mentor.average_rating.toFixed(1)}/5` : "No ratings yet"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {mentor.subjects && mentor.subjects.length > 0 ? (
                mentor.subjects.map((subject) => (
                  <span key={subject} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                    {subject}
                  </span>
                ))
              ) : (
                <span className="text-xs text-zinc-500">No subjects listed.</span>
              )}
            </div>
          </div>
        </div>

        {confirmation && renderBookingConfirmation(confirmation)}

        {!isExpanded && !confirmation && (
          <Button onClick={() => setExpandedMentorId(mentor.id)} className="mt-3">
            Book session
          </Button>
        )}

        {isExpanded && !confirmation && (
          <div className={`mt-3 space-y-3 ${DARK_BOX}`}>
            <TimeSlotPicker
              selectedSlot={selectedTimeSlot}
              onSelectSlot={handleSelectSlot}
              blockedSlots={bookedSessions
                .filter((s) => s.mentor_id === mentor.id && (s.status === "requested" || s.status === "confirmed") && s.requested_time)
                .map((s) => s.requested_time as string)}
            />

            {selectedTimeSlot && renderMeetingTypeStep()}

            {conflictWarning && <p className="text-sm text-red-400">{conflictWarning}</p>}

            <div className="flex gap-2">
              <Button
                onClick={() => handleRequestSession(mentor.id, selectedSubject)}
                disabled={!selectedTimeSlot || !meetingType || requestingMentorId === mentor.id}
              >
                {requestingMentorId === mentor.id ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Requesting...
                  </span>
                ) : (
                  "Request session"
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={() => { setExpandedMentorId(null); setConflictWarning(null); }}
                className={DARK_SECONDARY_BUTTON}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

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

          {activeSection === "mentor-profiles" && (
            <Card className={DARK_CARD}>
              <div className="text-base font-semibold">Mentor Profiles</div>
              <div className="mt-4 grid gap-4">
                {mentors.length === 0 ? (
                  <p className="text-sm text-zinc-400">No mentors have joined yet.</p>
                ) : (
                  mentors.map((mentor) => {
                    const initials = initialsFor(mentor.display_name);
                    const mentorFeedback = ratingEntries.filter((r) => r.mentor_id === mentor.id);
                    const totalRatings = mentorFeedback.length;
                    const recentFeedback = mentorFeedback.slice(0, 3);
                    const roundedRating = Math.round(mentor.average_rating ?? 0);

                    return (
                      <div key={mentor.id} className="rounded-xl border border-zinc-800 p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-white">{mentor.display_name || "Unnamed mentor"}</div>
                            <div className="mt-0.5 text-sm text-zinc-400">{mentor.grade || "Year not set"}</div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {mentor.subjects && mentor.subjects.length > 0 ? (
                                mentor.subjects.map((subject) => (
                                  <span key={subject} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                                    {subject}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-zinc-500">No subjects listed.</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                          <div className="text-3xl font-semibold text-white">
                            {mentor.average_rating ? mentor.average_rating.toFixed(1) : "—"}
                          </div>
                          <div>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={14}
                                  className={star <= roundedRating ? "text-yellow-400" : "text-zinc-600"}
                                  fill={star <= roundedRating ? "currentColor" : "none"}
                                />
                              ))}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {totalRatings} rating{totalRatings === 1 ? "" : "s"}
                            </div>
                          </div>
                        </div>

                        {recentFeedback.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <div className="text-xs font-medium text-zinc-500">Recent feedback</div>
                            {recentFeedback.map((entry, index) => {
                              const studentInitials = initialsFor(entry.student?.display_name);
                              return (
                                <div key={index} className="rounded border border-zinc-800 p-2 text-sm">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-white">{studentInitials}</span>
                                    <div className="flex gap-0.5">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                          key={star}
                                          size={12}
                                          className={star <= entry.rating ? "text-yellow-400" : "text-zinc-600"}
                                          fill={star <= entry.rating ? "currentColor" : "none"}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                  {entry.feedback && (
                                    <p className="mt-1 text-zinc-400">{entry.feedback}</p>
                                  )}
                                  {entry.student_tags && entry.student_tags.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {entry.student_tags.map((tag) => (
                                        <span key={tag} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          )}

          {activeSection === "my-sessions" && (
            <>
              <Card className={`${DARK_CARD} border-l-4 !border-l-green-500`}>
                <div className="text-base font-semibold">Today’s Match</div>
                {matchedMentor ? (
                  <div className="mt-2 space-y-2 text-sm text-zinc-400">
                    {confirmedSessionToday && (
                      <div className="flex items-center justify-between gap-3 rounded border border-zinc-800 bg-zinc-800 p-3">
                        <div>
                          <div><span className="font-medium text-white">Mentor:</span> {matchedMentor.display_name || "Unnamed mentor"}</div>
                          <div><span className="font-medium text-white">Time slot:</span> {confirmedSessionToday.requested_time}</div>
                        </div>
                        <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Session confirmed
                        </span>
                      </div>
                    )}
                    <Button variant="secondary" onClick={handleRematch} className={`ml-2 ${DARK_SECONDARY_BUTTON}`}>Rematch</Button>
                    <div><span className="font-medium text-white">Mentor:</span> {matchedMentor.display_name || "Unnamed mentor"}</div>
                    <div><span className="font-medium text-white">Subjects:</span> {matchedMentor.subjects?.join(", ") || "No subjects listed."}</div>
                    <div><span className="font-medium text-white">Bio:</span> {matchedMentor.bio ? matchedMentor.bio.slice(0, 80) + "..." : "No bio yet."}</div>
                    <a href={`/student/mentor/${matchedMentor.id}`} className="inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 transition-colors">View Mentor Profile</a>

                    {bookingConfirmation?.mentorId === matchedMentor.id ? (
                      renderBookingConfirmation(bookingConfirmation)
                    ) : (
                      <>
                        <div className="mt-2">
                          <TimeSlotPicker
                            selectedSlot={selectedTimeSlot}
                            onSelectSlot={handleSelectSlot}
                            blockedSlots={bookedSessions
                              .filter((s) => s.mentor_id === matchedMentor.id && (s.status === "requested" || s.status === "confirmed") && s.requested_time)
                              .map((s) => s.requested_time as string)}
                          />
                        </div>

                        {selectedTimeSlot && renderMeetingTypeStep()}

                        {conflictWarning && <p className="text-sm text-red-400">{conflictWarning}</p>}

                        <Button
                          onClick={() => handleRequestSession(matchedMentor.id, null)}
                          disabled={!selectedTimeSlot || !meetingType || requestingMentorId === matchedMentor.id}
                          className="ml-2"
                        >
                          {requestingMentorId === matchedMentor.id ? (
                            <span className="flex items-center gap-2">
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              Requesting...
                            </span>
                          ) : (
                            "Request Session"
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-400">No mentor assigned yet.</p>
                )}
              </Card>

              <Card className={`${DARK_CARD} mt-4`}>
                <div className="text-base font-semibold">Session Status</div>
                <div className="mt-2 space-y-2 text-sm text-zinc-400">
                  {bookedSessions.length === 0 ? (
                    <p>You have not booked any sessions yet.</p>
                  ) : (
                    bookedSessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 rounded border border-zinc-800 p-3">
                        <div>
                          <div><span className="font-medium text-white">Mentor:</span> {s.mentor?.display_name || "Unknown mentor"}</div>
                          <div><span className="font-medium text-white">Subject:</span> {s.subject || "Not specified"}</div>
                          <div><span className="font-medium text-white">Time slot:</span> {s.requested_time || "Not selected"}</div>
                          <div><span className="font-medium text-white">Date:</span> {new Date(s.created_at).toLocaleDateString()}</div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.status === "requested" ? "bg-yellow-100 text-yellow-800" :
                          s.status === "confirmed" ? "bg-green-100 text-green-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {s.status === "requested" ? "Pending" : s.status === "confirmed" ? "Confirmed" : "Declined"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className={`${DARK_CARD} mt-4`}>
                <div className="text-base font-semibold">Past Sessions</div>
                <div className="mt-2 space-y-2 text-sm text-zinc-400">
                  {pastSessions.length === 0 ? (
                    <p>No past sessions yet.</p>
                  ) : (
                    pastSessions.map((s) => (
                      <div key={s.id} className="rounded border border-zinc-800 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div><span className="font-medium text-white">Mentor:</span> {s.mentor?.display_name || "Unknown mentor"}</div>
                            <div><span className="font-medium text-white">Time slot:</span> {s.requested_time || "Not selected"}</div>
                            <div><span className="font-medium text-white">Date:</span> {new Date(s.created_at).toLocaleDateString()}</div>
                          </div>

                          {feedbackThanksSessionId === s.id ? (
                            <span className="shrink-0 text-sm text-green-400">Thanks for your feedback</span>
                          ) : s.student_rating_of_mentor === null && expandedFeedbackSessionId !== s.id ? (
                            <Button
                              variant="secondary"
                              onClick={() => handleOpenFeedback(s.id)}
                              className={`shrink-0 !px-3 !py-1 !text-xs ${DARK_SECONDARY_BUTTON}`}
                            >
                              Leave feedback
                            </Button>
                          ) : null}
                        </div>

                        {expandedFeedbackSessionId === s.id && (
                          <div className={`mt-3 space-y-3 ${DARK_BOX}`}>
                            <div className="text-sm text-zinc-400">
                              <div><span className="text-zinc-500">Mentor:</span> {s.mentor?.display_name || "Unknown mentor"}</div>
                              <div><span className="text-zinc-500">Subject:</span> {s.subject || "Not specified"}</div>
                              <div><span className="text-zinc-500">Time slot:</span> {s.requested_time || "Not selected"}</div>
                            </div>

                            <div>
                              <div className="text-sm font-medium text-white">How was your session?</div>
                              <div className="mt-2 flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button key={star} type="button" onClick={() => setFeedbackRating(star)}>
                                    <Star
                                      size={24}
                                      className={star <= (feedbackRating ?? 0) ? "text-yellow-400" : "text-zinc-600"}
                                      fill={star <= (feedbackRating ?? 0) ? "currentColor" : "none"}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div className="text-sm font-medium text-white">What stood out?</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {STUDENT_FEEDBACK_TAGS.map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => toggleFeedbackTag(tag)}
                                    className={`rounded-full border px-3 py-1 text-xs ${
                                      feedbackTags.includes(tag) ? "border-indigo-500 bg-indigo-600 text-white" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                                    }`}
                                  >
                                    {tag}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <textarea
                                value={feedbackComment}
                                onChange={(e) => setFeedbackComment(e.target.value.slice(0, 200))}
                                placeholder="One or two lines your mentor can learn from..."
                                rows={3}
                                className="w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-sm text-white placeholder:text-zinc-500"
                              />
                              <div className="mt-1 text-right text-xs text-zinc-500">{feedbackComment.length} / 200</div>
                            </div>

                            <div className="flex gap-2">
                              <Button onClick={() => handleSubmitFeedback(s.id)} disabled={!feedbackRating || submittingFeedback}>
                                {submittingFeedback ? "Submitting..." : "Submit rating"}
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => setExpandedFeedbackSessionId(null)}
                                className={DARK_SECONDARY_BUTTON}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className={`${DARK_CARD} mt-4`}>
                <div className="text-base font-semibold">Recent Match History</div>
                <div className="mt-2 space-y-2 text-sm text-zinc-400">
                  {matchHistory.length === 0 ? (
                    <p>No recent matches yet.</p>
                  ) : (
                    matchHistory.map((match, index) => (
                      <div key={`${match.mentor_id}-${match.created_at}-${index}`} className="rounded border border-zinc-800 p-3">
                        <div><span className="font-medium text-white">Mentor:</span> {mentors.find((mentor) => mentor.id === match.mentor_id)?.display_name || "Unknown mentor"}</div>
                        <div><span className="font-medium text-white">Date:</span> {new Date(match.created_at).toLocaleDateString()}</div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </>
          )}

          {activeSection === "find-tutor" && (
            <Card className={DARK_CARD}>
              <div className="text-base font-semibold">Find a Tutor</div>

              {!selectedSubject ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {SUBJECTS.map((subject) => (
                    <button
                      key={subject.name}
                      type="button"
                      onClick={() => setSelectedSubject(subject.name)}
                      className="rounded-xl border border-zinc-800 p-4 text-center hover:bg-zinc-800"
                    >
                      <div className="text-2xl">{subject.emoji}</div>
                      <div className="mt-1 text-sm font-medium">{subject.name}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => { setSelectedSubject(null); setExpandedMentorId(null); }}
                    className="text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    ← Choose a different subject
                  </button>
                  <p className="mt-2 text-sm text-zinc-400">
                    {subjectMentors.length === 0
                      ? `No mentors teach ${selectedSubject} yet.`
                      : `${subjectMentors.length} mentor${subjectMentors.length === 1 ? "" : "s"} teaching ${selectedSubject}.`}
                  </p>

                  <div className="mt-4 grid gap-3">
                    {subjectMentors.map((mentor) => renderMentorBookingCard(mentor))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {activeSection === "profile" && (
            <Card className={DARK_CARD}>
              <div className="text-base font-semibold">Edit Profile</div>
              <div className="mt-2 space-y-2">
                <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-sm text-white placeholder:text-zinc-500" placeholder="Name" />
                <input value={gradeInput} onChange={(e) => setGradeInput(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-sm text-white placeholder:text-zinc-500" placeholder="Grade" />
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
