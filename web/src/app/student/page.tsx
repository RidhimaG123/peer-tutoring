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

  async function handleRequestSession() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session || !matchedMentorId) return;

    await supabase
      .from("sessions")
      .insert({
        student_id: session.user.id,
        mentor_id: matchedMentorId,
        status: "requested"
      });

    window.location.reload();
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

  if (loading) return null;

  const matchedMentor = mentors.find((mentor) => mentor.id === matchedMentorId) ?? null;

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <button onClick={() => router.push("/")} className="mb-3 rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">← Home</button>
          <div className="text-lg font-semibold">Student Dashboard</div>
          <p className="mt-2 text-sm text-zinc-600">
            Browse mentors and profile details in this milestone.
          </p>
        </div>

        <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-base font-semibold">Your Profile</div>
          <div className="mt-2 space-y-1 text-sm text-zinc-700">
            <div><span className="font-medium">Name:</span> {profile?.display_name || "Not set"}</div>
            <div><span className="font-medium">Grade:</span> {profile?.grade || "Not set"}</div>
            <div><span className="font-medium">Subjects:</span> {profile?.subjects?.join(", ") || "Not set"}</div>
            <div><span className="font-medium">Bio:</span> {profile?.bio || "Not set"}</div>
            <div><span className="font-medium">Availability:</span> {profile?.availability_preference || "Not set"}</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-base font-semibold">Edit Profile</div>
          <div className="mt-2 space-y-2">
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Name" />
            <input value={gradeInput} onChange={(e) => setGradeInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Grade" />
            <input value={subjectsInput} onChange={(e) => setSubjectsInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Subjects (comma separated)" />
            <textarea value={bioInput} onChange={(e) => setBioInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Bio" />
            <input value={availabilityInput} onChange={(e) => setAvailabilityInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Availability" />
            <button onClick={handleSave} className="mt-2 rounded bg-zinc-900 px-4 py-2 text-sm text-white">Save</button>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border bg-green-50 p-5 shadow-sm">
          <div className="text-base font-semibold">Today’s Match</div>
          {matchedMentor ? (
            <div className="mt-2 space-y-2 text-sm text-zinc-700">
              <button onClick={handleRematch} className="ml-2 rounded border px-4 py-2 text-sm">Rematch</button>
              <div><span className="font-medium">Mentor:</span> {matchedMentor.display_name || "Unnamed mentor"}</div>
              <div><span className="font-medium">Subjects:</span> {matchedMentor.subjects?.join(", ") || "No subjects listed."}</div>
              <div><span className="font-medium">Bio:</span> {matchedMentor.bio ? matchedMentor.bio.slice(0, 80) + "..." : "No bio yet."}</div>
              <a href={`/student/mentor/${matchedMentor.id}`} className="inline-block rounded bg-zinc-900 px-4 py-2 text-sm text-white">View Mentor Profile</a>
              <button onClick={handleRequestSession} className="ml-2 rounded bg-blue-600 px-4 py-2 text-sm text-white">Request Session</button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-700">No mentor assigned yet.</p>
          )}
        </div>


        <div className="mt-4 rounded-2xl border bg-yellow-50 p-5 shadow-sm">
          <div className="text-base font-semibold">Pending Ratings</div>
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

        <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
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
              <a href={`/student/mentor/${mentor.id}`} className="block">
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
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
