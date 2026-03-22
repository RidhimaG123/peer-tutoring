"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MentorProfile = {
  id: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  subjects: string[] | null;
  grade: string | null;
  availability_preference: string | null;
};

export default function MentorProfilePage({ params }: { params: { id: string } }) {
  const [mentor, setMentor] = useState<MentorProfile | null>(null);
  useEffect(() => {
    async function loadMentor() {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, headline, bio, subjects, grade, availability_preference")
        .eq("id", params.id)
        .single();

      setMentor(data);
    }

    loadMentor();
  }, [params.id]);

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold">Mentor Profile</div>
          {mentor ? (
            <div className="mt-2 space-y-2 text-sm text-zinc-700">
              <div><span className="font-medium">Name:</span> {mentor.display_name || "Unnamed mentor"}</div>
              <div><span className="font-medium">Headline:</span> {mentor.headline || "No headline"}</div>
              <div><span className="font-medium">Subjects:</span> {mentor.subjects?.join(", ") || "None"}</div>
              <div><span className="font-medium">Bio:</span> {mentor.bio || "No bio"}</div>
              <div><span className="font-medium">Availability:</span> {mentor.availability_preference || "Not set"}</div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">Loading mentor...</p>
          )}
        </div>
      </div>
    </main>
  );
}
