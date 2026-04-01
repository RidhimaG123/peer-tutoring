"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/Button";
import { User, Star, Calendar } from "lucide-react";

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
  const [currentSession, setCurrentSession] = useState<{ id: string; mentor_id: string; status: string } | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  async function loadDashboardData() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role, display_name, grade, bio, subjects, availability_preference")
      .eq("id", session.user.id)
      .single();

    setProfile(profileData);
    if (profileData) {
      setNameInput(profileData.display_name || "");
      setGradeInput(profileData.grade || "");
      setSubjectsInput(profileData.subjects?.join(", ") || "");
      setBioInput(profileData.bio || "");
      setAvailabilityInput(profileData.availability_preference || "");
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

    const { data: currentSessionData } = await supabase
      .from("sessions")
      .select("id, mentor_id, status")
      .eq("student_id", session.user.id)
      .in("status", ["requested", "confirmed", "declined", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setCurrentSession(currentSessionData ?? null);

    const { data: mentorsData } = await supabase
      .from("profiles")
      .select("id, display_name, headline, bio, subjects")
      .eq("role", "mentor")
      .order("created_at", { ascending: false });

    const mentorsWithRatings = (mentorsData ?? []).map((mentor) => {
      const mentorRatings = (ratingData ?? [])
        .filter((s) => s.mentor_id === mentor.id)
        .map((s) => s.rating as number);
      const average_rating = mentorRatings.length > 0
        ? mentorRatings.reduce((sum, r) => sum + r, 0) / mentorRatings.length
        : null;
      return { ...mentor, average_rating };
    });
    setMentors(mentorsWithRatings);
    setRequesting(false);
  }

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
    await loadDashboardData();
  }

  async function handleRequestSession(mentorId: string) {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (requesting || !session || !mentorId || !selectedSlots[mentorId]) return;

    setRequesting(true);

    const { data: existingRequest } = await supabase
      .from("sessions")
      .select("id")
      .eq("student_id", session.user.id)
      .eq("mentor_id", mentorId)
      .eq("requested_time", selectedSlots[mentorId])
      .in("status", ["requested", "confirmed"])
      .maybeSingle();

    if (existingRequest) {
      setRequesting(false);
      return;
    }
    const { error } = await supabase
      .from("sessions")
      .insert({
        student_id: session.user.id,
        mentor_id: mentorId,
        requested_time: selectedSlots[mentorId],
        status: "requested",
      });

    if (error) {
      setRequesting(false);
      console.error("request session error", error);
      return;
    }

    await loadDashboardData();

  }
  async function handleRateSession(sessionId: string, rating: number) {
    await supabase
      .from("sessions")
      .update({ rating })
      .eq("id", sessionId);

    await loadDashboardData();
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
    await loadDashboardData();
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
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
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

      const { data: currentSessionData } = await supabase
        .from("sessions")
        .select("id, mentor_id, status")
        .eq("student_id", session.user.id)
        .in("status", ["requested", "confirmed", "declined", "completed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setCurrentSession(currentSessionData ?? null);


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
      setLoading(false);
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

  if (loading) return (
    <main className="min-h-dvh bg-zinc-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-zinc-900" />
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    </main>
  );

  const matchedMentor = mentors.find((mentor) => mentor.id === matchedMentorId) ?? null;

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold">Student Dashboard</div>
          <p className="mt-2 text-sm text-zinc-600">
            Welcome back! Here&apos;s your tutoring dashboard.
          </p>
        </div>

        <div className="mt-4 rounded-2xl border bg-green-50 p-5 shadow-sm">
          <div className="text-base font-semibold">Today&apos;s Match</div>
          {matchedMentor ? (
            <div className="mt-2 space-y-2 text-sm text-zinc-700">
              <Button variant="secondary" onClick={handleRematch} className="ml-2">Rematch</Button>
              <div><span className="font-medium">Mentor:</span> {matchedMentor.display_name || "Unnamed mentor"}</div>
              <div><span className="font-medium">Subjects:</span> {matchedMentor.subjects?.join(", ") || "No subjects listed."}</div>
              <div><span className="font-medium">Bio:</span> {matchedMentor.bio ? matchedMentor.bio.slice(0, 80) + "..." : "No bio yet."}</div>
              <a href={`/student/mentor/${matchedMentor.id}`} className="inline-block rounded bg-zinc-900 px-4 py-2 text-sm text-white">View Mentor Profile</a>
              <div className="mt-2">
                <div className="mb-2 text-xs font-medium text-zinc-700 flex items-center gap-1"><Calendar size={12} /> Choose a time slot</div>
                <div className="flex flex-wrap gap-2">
                  {["Monday 4:00 PM", "Tuesday 5:00 PM", "Wednesday 6:00 PM"].map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlots(prev => ({ ...prev, [matchedMentor.id]: slot }))}
                      className={`rounded border px-3 py-1 text-xs ${selectedSlots[matchedMentor.id] === slot ? "bg-zinc-900 text-white" : "bg-white"}`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
              <Button variant="primary" onClick={() => handleRequestSession(matchedMentor.id)} className="ml-2">Request Session</Button>
              {currentSession && currentSession.mentor_id === matchedMentor.id && (
                <div className="mt-2 rounded border bg-white p-3 text-xs">
                  <span className="font-medium">Session Status:</span> {
                    currentSession.status === "requested" ? "Pending ⏳" :
                    currentSession.status === "confirmed" ? "Accepted ✅" :
                    currentSession.status === "completed" ? "Completed ✅" :
                    currentSession.status === "declined" ? "Declined ❌" :
                    currentSession.status
                  }
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-700">No mentor assigned yet.</p>
          )}
        </div>

        <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
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
            {filteredMentors.map((mentor) => (
              <div key={mentor.id} className="block w-full text-left">
                <div className="rounded-xl border p-4 hover:bg-zinc-50">
                <div className="text-sm font-semibold">
                  {mentor.display_name || "Unnamed mentor"}
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  {mentor.headline || "No headline yet."}
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  {mentor.subjects?.join(", ") || "No subjects listed."}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {mentor.average_rating ? `Rating: ${mentor.average_rating.toFixed(1)}/5` : "No ratings yet."}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {mentor.bio ? mentor.bio.slice(0, 80) + "..." : "No bio yet."}
                </div>
                  <div className="mt-3">
                    <div className="mb-2 text-xs font-medium text-zinc-700 flex items-center gap-1"><Calendar size={12} /> Choose a time slot</div>
                    <div className="flex flex-wrap gap-2">
                      {["Monday 4:00 PM", "Tuesday 5:00 PM", "Wednesday 6:00 PM"].map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedSlots(prev => ({ ...prev, [mentor.id]: slot }))}
                          className={`rounded border px-3 py-1 text-xs ${selectedSlots[mentor.id] === slot ? "bg-zinc-900 text-white" : "bg-white"}`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button variant="primary" disabled={requesting} onClick={() => handleRequestSession(mentor.id)} className="mt-3">{requesting ? "Requesting..." : "Request Session"}</Button>
                  {currentSession && currentSession.mentor_id === mentor.id && (
                    <div className="mt-2 rounded border bg-white p-2 text-xs">
                      <span className="font-medium">Status:</span> {
                        currentSession.status === "requested" ? "Pending ⏳" :
                        currentSession.status === "confirmed" ? "Accepted ✅" :
                        currentSession.status === "declined" ? "Declined ❌" :
                        currentSession.status
                      }
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold flex items-center gap-2"><User size={16} /> Your Profile</div>
            <button onClick={() => setEditing(!editing)} className="rounded border px-3 py-1 text-xs hover:bg-zinc-50">
              {editing ? "Cancel" : "Edit"}
            </button>
          </div>
          {!editing ? (
            <div className="mt-2 space-y-1 text-sm text-zinc-700">
              <div><span className="font-medium">Name:</span> {profile?.display_name || "Not set"}</div>
              <div><span className="font-medium">Grade:</span> {profile?.grade || "Not set"}</div>
              <div><span className="font-medium">Subjects:</span> {profile?.subjects?.join(", ") || "Not set"}</div>
              <div><span className="font-medium">Bio:</span> {profile?.bio || "Not set"}</div>
              <div><span className="font-medium">Availability:</span> {profile?.availability_preference || "Not set"}</div>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Name</label>
                <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Your full name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Grade</label>
                <input value={gradeInput} onChange={(e) => setGradeInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="e.g. 10th" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Subjects</label>
                <input value={subjectsInput} onChange={(e) => setSubjectsInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Math, Science, English" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Bio</label>
                <textarea value={bioInput} onChange={(e) => setBioInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Tell mentors about yourself" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Availability</label>
                <input value={availabilityInput} onChange={(e) => setAvailabilityInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="e.g. Weekdays after 4 PM" />
              </div>
              <Button variant="primary" onClick={async () => { await handleSave(); setEditing(false); }} className="mt-2">Save</Button>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-base font-semibold flex items-center gap-2"><Star size={16} /> Activity</div>
          <div className="mt-3">
            <div className="text-sm font-medium text-zinc-800">Pending Ratings</div>
            <div className="mt-2 space-y-2 text-sm text-zinc-700">
              {pendingRatings.length === 0 ? (
                <p>No sessions to rate.</p>
              ) : (
                pendingRatings.map((session) => (
                  <div key={session.id} className="rounded border p-3">
                    <div><span className="font-medium">Mentor:</span> {mentors.find((m) => m.id === session.mentor_id)?.display_name || "Unknown"}</div>
                    <div className="mt-2 space-x-2">
                      {[1,2,3,4,5].map((r) => (
                        <button key={r} onClick={() => handleRateSession(session.id, r)} className="rounded bg-yellow-400 px-2 py-1 text-xs">
                          {r}★
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-medium text-zinc-800">Recent Matches</div>
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
          </div>
        </div>
      </div>
    </main>
  );
}
