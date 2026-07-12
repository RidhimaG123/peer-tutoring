"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/Button";
import Card from "@/components/Card";

type SessionRequest = {
  id: string;
  student_id: string;
  status: string;
  created_at: string;
  requested_time: string | null;
  student: {
    display_name: string | null;
    bio: string | null;
    subjects: string[] | null;
    grade: string | null;
  } | null;
};

type MentorProfile = {
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  subjects: string[] | null;
  availability_preference: string | null;
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
    const { error } = await supabase
      .from("sessions")
      .update({ status: "declined" })
      .eq("id", sessionId);

    if (error) {
      console.error("decline session error", error);
      return;
    }

    setRequests((prev) => prev.filter((r) => r.id !== sessionId));
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

  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [headlineInput, setHeadlineInput] = useState("");
  const [subjectsInput, setSubjectsInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [availabilityInput, setAvailabilityInput] = useState("");
  const [requests, setRequests] = useState<SessionRequest[]>([]);
  const [mentorId, setMentorId] = useState<string | null>(null);

  async function loadSessionRequests(mentorId: string) {
    const { data: sessionRequests } = await supabase
      .from("sessions")
      .select("id, student_id, status, created_at, requested_time, student:profiles!sessions_student_id_fkey(display_name, bio, subjects, grade)")
      .in("status", ["requested", "confirmed"])
      .eq("mentor_id", mentorId)
      .order("created_at", { ascending: false });

    setRequests((sessionRequests ?? []).map(r => ({ ...r, student: Array.isArray(r.student) ? r.student[0] ?? null : r.student })));
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

      setProfile(profile);

      if (profile) {
        setNameInput(profile.display_name || "");
        setHeadlineInput(profile.headline || "");
        setSubjectsInput(profile.subjects?.join(", ") || "");
        setBioInput(profile.bio || "");
        setAvailabilityInput(profile.availability_preference || "");
      }

      setMentorId(session.user.id);
      await loadSessionRequests(session.user.id);

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

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <Button variant="secondary" onClick={() => router.push("/")} className="mb-3">← Home</Button>
          <div className="text-lg font-semibold">Mentor Dashboard</div>
          <p className="mt-2 text-sm text-zinc-600">
            Milestone 1 complete: protected mentor view.
          </p>
        </Card>

        <Card className="mt-4">
          <div className="text-base font-semibold">Your Profile</div>
          <div className="mt-2 space-y-1 text-sm text-zinc-700">
            <div><span className="font-medium">Name:</span> {profile?.display_name || "Not set"}</div>
            <div><span className="font-medium">Headline:</span> {profile?.headline || "Not set"}</div>
            <div><span className="font-medium">Subjects:</span> {profile?.subjects?.join(", ") || "Not set"}</div>
            <div><span className="font-medium">Bio:</span> {profile?.bio || "Not set"}</div>
            <div><span className="font-medium">Availability:</span> {profile?.availability_preference || "Not set"}</div>
          </div>
        </Card>

        <Card className="mt-4">
          <div className="text-base font-semibold">Edit Profile</div>
          <div className="mt-2 space-y-2">
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Name" />
            <input value={headlineInput} onChange={(e) => setHeadlineInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Headline" />
            <input value={subjectsInput} onChange={(e) => setSubjectsInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Subjects (comma separated)" />
            <textarea value={bioInput} onChange={(e) => setBioInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Bio" />
            <input value={availabilityInput} onChange={(e) => setAvailabilityInput(e.target.value)} className="w-full rounded border p-2 text-sm" placeholder="Availability" />
            <Button onClick={handleSave} className="mt-2">Save</Button>
          </div>
        </Card>

        <Card className="mt-4">
          <div className="text-base font-semibold">Session Requests</div>
          <div className="mt-2 space-y-2 text-sm text-zinc-700">
            {requests.length === 0 ? (
              <p>No pending session requests.</p>
            ) : (
              requests.map((request) => (
                <div key={request.id} className="rounded border p-3">
                  <div><span className="font-medium">Student:</span> {request.student?.display_name || "Unnamed student"}</div>
                  <div><span className="font-medium">Grade:</span> {request.student?.grade || "Not set"}</div>
                  <div><span className="font-medium">Subjects:</span> {request.student?.subjects?.join(", ") || "Not set"}</div>
                  <div><span className="font-medium">Bio:</span> {request.student?.bio || "No bio yet."}</div>
                  <div><span className="font-medium">Requested Time:</span> {request.requested_time || "Not selected"}</div>
                  <div><span className="font-medium">Status:</span> {request.status}</div>
                  {request.status === "requested" && (
                    <div className="mt-2 flex gap-2">
                      <Button variant="accent" onClick={() => handleAcceptSession(request.id)} className="!px-3 !py-1 !text-xs">Accept</Button>
                      <Button variant="secondary" onClick={() => handleDeclineSession(request.id)} className="!px-3 !py-1 !text-xs">Decline</Button>
                    </div>
                  )}
                  {request.status === "confirmed" && (
                    <Button onClick={() => handleCompleteSession(request.id)} className="mt-2 ml-2 !px-3 !py-1 !text-xs">Mark Complete</Button>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
