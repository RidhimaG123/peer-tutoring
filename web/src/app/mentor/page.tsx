"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/Button";
import Card from "@/components/Card";

type Section = "feed" | "my-sessions" | "profile";

const NAV_ITEMS: { key: Section; label: string }[] = [
  { key: "feed", label: "Feed" },
  { key: "my-sessions", label: "My Sessions" },
];

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

      setRequests((prev) => prev.filter((r) => r.id !== sessionId));
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

  async function handleLogout() {
    await supabase.auth.signOut();
    setTimeout(() => { window.location.href = "/"; }, 500);
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
    <div className="flex min-h-dvh bg-zinc-50 text-zinc-900">
      <aside className="hidden md:flex md:w-56 md:flex-col md:bg-zinc-900">
        {sidebarNav()}
      </aside>

      <div className="flex-1">
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
            <Card>
              <div className="text-base font-semibold">Feed</div>
              <p className="mt-2 text-sm text-zinc-600">Coming soon.</p>
            </Card>
          )}

          {activeSection === "my-sessions" && (
            <Card>
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
          )}

          {activeSection === "profile" && (
            <Card>
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
          )}
        </div>
      </div>
    </div>
  );
}
