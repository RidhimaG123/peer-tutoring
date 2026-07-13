"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatDayLabel } from "@/lib/weekSlots";
import Button from "@/components/Button";
import Card from "@/components/Card";
import TimeSlotPicker from "@/components/TimeSlotPicker";

type MentorProfile = {
  id: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  subjects: string[] | null;
  average_rating: number | null;
};

type StudentProfile = {
  display_name: string | null;
  grade: string | null;
  bio: string | null;
  subjects: string[] | null;
  availability_preference: string | null;
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
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [availabilityInput, setAvailabilityInput] = useState("");
  const [matchHistory, setMatchHistory] = useState<{ mentor_id: string; created_at: string }[]>([]);
  const [pendingRatings, setPendingRatings] = useState<{ id: string; mentor_id: string; created_at: string }[]>([]);
  const [bookedSessions, setBookedSessions] = useState<{ id: string; status: string; requested_time: string | null; created_at: string; mentor_id: string; mentor: { display_name: string | null } | null }[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [hoveredRating, setHoveredRating] = useState<{ sessionId: string; rating: number } | null>(null);
  const [requestingMentorId, setRequestingMentorId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "mentors" | "profile">("dashboard");
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

  async function handleRequestSession(mentorId: string) {
    if (!mentorId || !selectedTimeSlot) return;

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
          status: "requested",
        });

      if (error) {
        console.error("request session error", error);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      window.location.reload();
    } finally {
      setRequestingMentorId(null);
    }
  }

  async function handleRateSession(sessionId: string, rating: number) {
    await supabase
      .from("sessions")
      .update({ rating })
      .eq("id", sessionId);

    window.location.reload();
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

        const { data: pendingRatingData } = await supabase
          .from("sessions")
          .select("id, mentor_id, created_at")
          .eq("student_id", session.user.id)
          .eq("status", "completed")
          .is("rating", null)
          .order("created_at", { ascending: false });

        setPendingRatings(pendingRatingData ?? []);
        const { data: ratingData } = await supabase
          .from("sessions")
          .select("mentor_id, rating")
          .not("rating", "is", null);

        const { data: bookedSessionsData } = await supabase
          .from("sessions")
          .select("id, status, requested_time, created_at, mentor_id, mentor:profiles!sessions_mentor_id_fkey(display_name)")
          .eq("student_id", session.user.id)
          .in("status", ["requested", "confirmed", "declined"])
          .order("created_at", { ascending: false });

        setBookedSessions((bookedSessionsData ?? []).map((s) => ({
          ...s,
          mentor: Array.isArray(s.mentor) ? s.mentor[0] ?? null : s.mentor,
        })));


        const { data: mentorsData } = await supabase
          .from("profiles")
          .select("id, display_name, headline, bio, subjects")
          .eq("role", "mentor")
          .order("created_at", { ascending: false });

        const mentorsWithRatings = (mentorsData ?? []).map((mentor) => {
          const mentorRatings = (ratingData ?? [])
            .filter((session) => session.mentor_id === mentor.id)
            .map((session) => session.rating as number);

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


  const filteredMentors = mentors.filter((mentor) => {
    const subjectMatch = !subjectFilter || mentor.subjects?.some((s) =>
      s.toLowerCase().includes(subjectFilter.toLowerCase())
    );

    const gradeMatch = !gradeFilter || mentor.headline?.toLowerCase().includes(gradeFilter.toLowerCase());

    return subjectMatch && gradeMatch;
  });

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

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <Button variant="secondary" onClick={() => router.push("/")} className="mb-3">← Home</Button>
          <div className="text-lg font-semibold">Student Dashboard</div>
          <p className="mt-2 text-sm text-zinc-600">
            Browse mentors and profile details in this milestone.
          </p>
        </Card>

        <Card className="mt-4">
          <div className="flex gap-2">
            <Button
              variant={activeTab === "dashboard" ? "primary" : "secondary"}
              onClick={() => setActiveTab("dashboard")}
              className="!px-3 !py-1.5 !text-xs"
            >
              Dashboard
            </Button>
            <Button
              variant={activeTab === "mentors" ? "primary" : "secondary"}
              onClick={() => setActiveTab("mentors")}
              className="!px-3 !py-1.5 !text-xs"
            >
              Mentors
            </Button>
            <Button
              variant={activeTab === "profile" ? "primary" : "secondary"}
              onClick={() => setActiveTab("profile")}
              className="!px-3 !py-1.5 !text-xs"
            >
              Profile
            </Button>
          </div>
        </Card>

        {activeTab === "dashboard" && (
          <>
            <Card variant="success" className="mt-4">
              <div className="text-base font-semibold">Today’s Match</div>
              {matchedMentor ? (
                <div className="mt-2 space-y-2 text-sm text-zinc-700">
                  {confirmedSessionToday && (
                    <div className="flex items-center justify-between gap-3 rounded border bg-white p-3">
                      <div>
                        <div><span className="font-medium">Mentor:</span> {matchedMentor.display_name || "Unnamed mentor"}</div>
                        <div><span className="font-medium">Time slot:</span> {confirmedSessionToday.requested_time}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        Session confirmed
                      </span>
                    </div>
                  )}
                  <Button variant="secondary" onClick={handleRematch} className="ml-2">Rematch</Button>
                  <div><span className="font-medium">Mentor:</span> {matchedMentor.display_name || "Unnamed mentor"}</div>
                  <div><span className="font-medium">Subjects:</span> {matchedMentor.subjects?.join(", ") || "No subjects listed."}</div>
                  <div><span className="font-medium">Bio:</span> {matchedMentor.bio ? matchedMentor.bio.slice(0, 80) + "..." : "No bio yet."}</div>
                  <a href={`/student/mentor/${matchedMentor.id}`} className="inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 transition-colors">View Mentor Profile</a>
                  <div className="mt-2">
                    <TimeSlotPicker
                      selectedSlot={selectedTimeSlot}
                      onSelectSlot={setSelectedTimeSlot}
                      blockedSlots={bookedSessions
                        .filter((s) => s.mentor_id === matchedMentor.id && (s.status === "requested" || s.status === "confirmed") && s.requested_time)
                        .map((s) => s.requested_time as string)}
                    />
                  </div>
                  <Button
                    onClick={() => handleRequestSession(matchedMentor.id)}
                    disabled={requestingMentorId === matchedMentor.id}
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
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-700">No mentor assigned yet.</p>
              )}
            </Card>

            <Card className="mt-4">
              <div className="text-base font-semibold">Session Status</div>
              <div className="mt-2 space-y-2 text-sm text-zinc-700">
                {bookedSessions.length === 0 ? (
                  <p>No sessions booked yet.</p>
                ) : (
                  bookedSessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 rounded border p-3">
                      <div>
                        <div><span className="font-medium">Mentor:</span> {s.mentor?.display_name || "Unknown mentor"}</div>
                        <div><span className="font-medium">Time slot:</span> {s.requested_time || "Not selected"}</div>
                        <div><span className="font-medium">Date requested:</span> {new Date(s.created_at).toLocaleDateString()}</div>
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

            <Card variant="warning" className="mt-4">
              <div className="text-base font-semibold">Pending Ratings</div>
              <div className="mt-2 space-y-2 text-sm text-zinc-700">
                {pendingRatings.length === 0 ? (
                  <p>No sessions to rate.</p>
                ) : (
                  pendingRatings.map((session) => (
                    <div key={session.id} className="rounded border p-3">
                      <div><span className="font-medium">Mentor:</span> {mentors.find((m) => m.id === session.mentor_id)?.display_name || "Unknown"}</div>
                      <div className="mt-2 flex gap-1">
                        {[1, 2, 3, 4, 5].map((r) => {
                          const isFilled = r <= (hoveredRating?.sessionId === session.id ? hoveredRating.rating : 0);
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => handleRateSession(session.id, r)}
                              onMouseEnter={() => setHoveredRating({ sessionId: session.id, rating: r })}
                              onMouseLeave={() => setHoveredRating(null)}
                              aria-label={`Rate ${r} star${r === 1 ? "" : "s"}`}
                              className="text-yellow-400 hover:scale-110 transition-transform"
                            >
                              <Star size={18} fill={isFilled ? "currentColor" : "none"} strokeWidth={1.5} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </>
        )}

        {activeTab === "mentors" && (
          <Card className="mt-4">
            <div className="text-base font-semibold">Mentor Directory</div>
            <p className="mt-2 text-sm text-zinc-600">
              {mentors.length === 0 ? "No mentors found yet." : `${mentors.length} mentor${mentors.length === 1 ? "" : "s"} available.`}
            </p>
            <input value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="mt-2 w-full rounded border p-2 text-sm" placeholder="Filter by grade" />
            <input value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="mt-3 w-full rounded border p-2 text-sm" placeholder="Filter by subject" />


            <div className="mt-4 grid gap-3">
              {mentors.length === 0 && (
                <div className="text-sm text-zinc-500">No mentors available yet.</div>
              )}
              {filteredMentors.map((mentor) => {
                const initials = (mentor.display_name || "?")
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("");
                const roundedRating = Math.round(mentor.average_rating ?? 0);

                return (
                  <div key={mentor.id} className="block w-full text-left">
                    <div className="rounded-xl border p-4 hover:bg-zinc-50">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">
                            {mentor.display_name || "Unnamed mentor"}
                          </div>
                          <div className="mt-0.5 text-sm text-zinc-600">
                            {mentor.headline || "No headline yet."}
                          </div>
                          <div className="mt-2 flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={14}
                                className={star <= roundedRating ? "text-yellow-400" : "text-zinc-300"}
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
                                <span key={subject} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                                  {subject}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-zinc-500">No subjects listed.</span>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-zinc-500">
                            {mentor.bio ? mentor.bio.slice(0, 80) + "..." : "No bio yet."}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <TimeSlotPicker
                          selectedSlot={selectedTimeSlot}
                          onSelectSlot={setSelectedTimeSlot}
                          blockedSlots={bookedSessions
                            .filter((s) => s.mentor_id === mentor.id && (s.status === "requested" || s.status === "confirmed") && s.requested_time)
                            .map((s) => s.requested_time as string)}
                        />
                      </div>
                      <Button
                        onClick={() => handleRequestSession(mentor.id)}
                        disabled={requestingMentorId === mentor.id}
                        className="mt-3"
                      >
                        {requestingMentorId === mentor.id ? (
                          <span className="flex items-center gap-2">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Requesting...
                          </span>
                        ) : (
                          "Request Session"
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {activeTab === "profile" && (
          <>
            <Card className="mt-4">
              <div className="text-base font-semibold">Edit Profile</div>
              <div className="mt-2 space-y-2">
                <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Name" />
                <input value={gradeInput} onChange={(e) => setGradeInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Grade" />
                <input value={subjectsInput} onChange={(e) => setSubjectsInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Subjects (comma separated)" />
                <textarea value={bioInput} onChange={(e) => setBioInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Bio" />
                <input value={availabilityInput} onChange={(e) => setAvailabilityInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Availability" />
                <Button onClick={handleSave} className="mt-2">Save</Button>
              </div>
            </Card>

            <Card className="mt-4">
              <div className="text-base font-semibold">Recent Match History</div>
              <div className="mt-2 space-y-2 text-sm text-zinc-700">
                {matchHistory.length === 0 ? (
                  <p>No recent matches yet.</p>
                ) : (
                  matchHistory.map((match, index) => (
                    <div key={`${match.mentor_id}-${match.created_at}-${index}`} className="rounded border p-3">
                      <div><span className="font-medium">Mentor:</span> {mentors.find((mentor) => mentor.id === match.mentor_id)?.display_name || "Unknown mentor"}</div>
                      <div><span className="font-medium">Date:</span> {new Date(match.created_at).toLocaleDateString()}</div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
