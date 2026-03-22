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
        {matchedMentorId && (
          <div className="mt-4 rounded-2xl border bg-green-50 p-5 shadow-sm">
            <div className="text-base font-semibold">Your Assigned Mentor</div>
            <p className="mt-2 text-sm text-zinc-700">
              You have been matched with 
              <span className="font-semibold">
                {matchedMentor?.display_name || "your mentor"}
              </span>.
            </p>
          </div>
        )}


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
              <div key={mentor.id} className="rounded-xl border p-4">
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
                  {mentor.bio ? mentor.bio.slice(0, 80) + "..." : "No bio yet."}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
