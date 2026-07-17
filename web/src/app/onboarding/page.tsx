"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "student" | "mentor";

const YEAR_GROUPS = ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13"];
const SUBJECTS = ["Maths", "English", "Economics", "Chemistry", "Biology", "Physics", "Computer Science", "Business"];

export default function OnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role | null>(null);
  const [firstName, setFirstName] = useState("");
  const [year, setYear] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);

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
        .select("display_name, role")
        .eq("id", session.user.id)
        .single();

      if (profile?.display_name) {
        router.replace(profile.role === "mentor" ? "/mentor" : profile.role === "admin" ? "/admin" : "/student");
        return;
      }

      setUserId(session.user.id);
      setChecking(false);
    }

    checkAccess();
  }, [router]);

  function toggleSubject(subject: string) {
    setSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  }

  async function finishOnboarding(finalSubjects?: string[]) {
    if (!userId || !role) return;

    setSaving(true);

    const updates: Record<string, unknown> = {
      display_name: firstName.trim(),
      role,
      grade: year,
    };

    if (role === "mentor") {
      updates.subjects = finalSubjects ?? [];
    }

    const { error } = await supabase.from("profiles").update(updates).eq("id", userId);

    if (error) {
      console.error("onboarding save error", error);
      setSaving(false);
      return;
    }

    router.replace(role === "mentor" ? "/mentor" : "/student");
  }

  if (checking) {
    return <main className="min-h-dvh bg-[#0a0a0a]" />;
  }

  const totalSteps = role === "mentor" ? 3 : 2;

  return (
    <main className="min-h-dvh bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="mb-8">
          <div className="text-xs text-zinc-500">
            {role ? `Step ${step} of ${totalSteps}` : "Step 1"}
          </div>
          <div className="mt-2 h-1 w-full rounded-full bg-zinc-800">
            <div
              className="h-1 rounded-full bg-indigo-500 transition-all"
              style={{ width: `${(step / (role ? totalSteps : 3)) * 100}%` }}
            />
          </div>
        </div>

        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="mb-4 text-sm text-zinc-400 hover:text-white"
          >
            ← Back
          </button>
        )}

        {step === 1 && (
          <div>
            <h1 className="text-2xl font-semibold">How will you use PeerPrep?</h1>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => { setRole("student"); setStep(2); }}
                className={`rounded-2xl border p-6 text-left transition-colors ${
                  role === "student" ? "border-indigo-500 bg-zinc-900" : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                }`}
              >
                <div className="text-base font-semibold">I need help with a subject</div>
                <p className="mt-2 text-sm text-zinc-400">
                  Get matched with a mentor and book time to work through what you’re stuck on.
                </p>
              </button>
              <button
                type="button"
                onClick={() => { setRole("mentor"); setStep(2); }}
                className={`rounded-2xl border p-6 text-left transition-colors ${
                  role === "mentor" ? "border-indigo-500 bg-zinc-900" : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                }`}
              >
                <div className="text-base font-semibold">I want to mentor</div>
                <p className="mt-2 text-sm text-zinc-400">
                  Help other students with subjects you’re strong in and pick up sessions when you’re free.
                </p>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-2xl font-semibold">Nice to meet you</h1>
            <div className="mt-6 space-y-5">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white placeholder:text-zinc-500"
              />

              <div>
                <div className="text-sm text-zinc-400">Year group</div>
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {YEAR_GROUPS.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setYear(y)}
                      className={`rounded-lg border px-2 py-2 text-xs ${
                        year === y ? "border-indigo-500 bg-indigo-600 text-white" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={!firstName.trim() || !year}
                onClick={() => (role === "mentor" ? setStep(3) : finishOnboarding())}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && role === "mentor" && (
          <div>
            <h1 className="text-2xl font-semibold">What can you teach?</h1>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SUBJECTS.map((subject) => {
                const selected = subjects.includes(subject);
                return (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => toggleSubject(subject)}
                    className={`rounded-lg border px-3 py-3 text-sm ${
                      selected ? "border-indigo-500 bg-indigo-600 text-white" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {subject}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={subjects.length === 0 || saving}
              onClick={() => finishOnboarding(subjects)}
              className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
            >
              {saving ? "Saving..." : "Finish setup"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
