"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SessionRequest = {
  id: string;
  student_id: string;
  status: string;
  created_at: string;
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
  const [requests, setRequests] = useState<SessionRequest[]>([]);

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
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role !== "mentor") {
        router.replace("/");
        return;
      }

      const { data: sessionRequests } = await supabase
        .from("sessions")
        .select("id, student_id, status, created_at")
        .eq("mentor_id", session.user.id)
        .eq("status", "requested")
        .order("created_at", { ascending: false });

      setRequests(sessionRequests ?? []);


      setLoading(false);
    }

    checkAccess();
  }, [router]);

  if (loading) return null;

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold">Mentor Dashboard</div>
          <p className="mt-2 text-sm text-zinc-600">
            Milestone 1 complete: protected mentor view.
          </p>
        </div>

        <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-base font-semibold">Session Requests</div>
          <div className="mt-2 space-y-2 text-sm text-zinc-700">
            {requests.length === 0 ? (
              <p>No pending session requests.</p>
            ) : (
              requests.map((request) => (
                <div key={request.id} className="rounded border p-3">
                  <div><span className="font-medium">Student ID:</span> {request.student_id}</div>
                  <div><span className="font-medium">Status:</span> {request.status}</div>
                  <button onClick={() => handleAcceptSession(request.id)} className="mt-2 rounded bg-green-600 px-3 py-1 text-xs text-white">Accept</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
