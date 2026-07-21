import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseSlotToUtcRange(slot: string): { startUtc: Date; endUtc: Date } | null {
  try {
    if (!slot) return null;

    const match = slot.match(/^\w+ (\d{1,2}) (\w{3}), (\d{1,2}):(\d{2})–(\d{1,2}):(\d{2}) (AM|PM)$/);
    if (!match) return null;

    const [, dayStr, monthStr, startHStr, startMStr, endHStr, endMStr, ampm] = match;
    const monthIndex = MONTH_NAMES.indexOf(monthStr);
    if (monthIndex === -1) return null;

    const day = parseInt(dayStr, 10);
    let startHour = parseInt(startHStr, 10);
    let endHour = parseInt(endHStr, 10);
    const startMinute = parseInt(startMStr, 10);
    const endMinute = parseInt(endMStr, 10);

    if (ampm === "AM") {
      if (startHour === 12) startHour = 0;
      if (endHour === 12) endHour = 0;
    } else {
      if (startHour !== 12) startHour += 12;
      if (endHour !== 12) endHour += 12;
    }

    const now = new Date();
    let year = now.getFullYear();

    // MYT is UTC+8, so local hour - 8 gives the UTC hour; Date.UTC normalizes
    // negative hours across day/month/year boundaries automatically.
    let startUtc = new Date(Date.UTC(year, monthIndex, day, startHour - 8, startMinute));
    let endUtc = new Date(Date.UTC(year, monthIndex, day, endHour - 8, endMinute));

    // If the resulting date is well in the past, the slot likely rolled into
    // next year (e.g. requested in late December for an early-January date).
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    if (startUtc.getTime() < now.getTime() - threeDaysMs) {
      year += 1;
      startUtc = new Date(Date.UTC(year, monthIndex, day, startHour - 8, startMinute));
      endUtc = new Date(Date.UTC(year, monthIndex, day, endHour - 8, endMinute));
    }

    if (isNaN(startUtc.getTime()) || isNaN(endUtc.getTime())) return null;

    return { startUtc, endUtc };
  } catch {
    return null;
  }
}

function toGoogleCalendarStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeHtml(value: string): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCalendarUrl(slot: string, mentorName: string, studentName: string): string | null {
  const range = parseSlotToUtcRange(slot);
  if (!range) return null;

  const dates = `${toGoogleCalendarStamp(range.startUtc)}/${toGoogleCalendarStamp(range.endUtc)}`;
  const details = `Peer Tutoring session between ${studentName || "a student"} and ${mentorName || "a mentor"}.`;

  const params = new URLSearchParams({
    text: "Peer Tutoring Session",
    dates,
    details,
    location: "Online",
  });

  return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`;
}

function renderEmailHtml({
  greetingName,
  introLine,
  mentorName,
  studentName,
  slot,
  calendarUrl,
}: {
  greetingName: string;
  introLine: string;
  mentorName: string;
  studentName: string;
  slot: string;
  calendarUrl: string | null;
}): string {
  const safeGreetingName = escapeHtml(greetingName);
  const safeMentorName = escapeHtml(mentorName);
  const safeStudentName = escapeHtml(studentName);
  const safeSlot = escapeHtml(slot);

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; background:#f4f4f5; padding:24px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <div style="background:#4f46e5;padding:20px 24px;">
          <div style="color:#ffffff;font-size:18px;font-weight:600;">Peer Tutoring</div>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;color:#18181b;">Hi ${safeGreetingName || "there"},</p>
          <p style="margin:0 0 16px;color:#3f3f46;">${introLine}</p>

          <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin:0 0 16px;">
            <table style="border-collapse:collapse;width:100%;font-size:14px;">
              <tr><td style="padding:4px 12px 4px 0;color:#71717a;">Mentor</td><td style="color:#18181b;"><strong>${safeMentorName || "your mentor"}</strong></td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#71717a;">Student</td><td style="color:#18181b;"><strong>${safeStudentName || "your student"}</strong></td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#71717a;">Time slot</td><td style="color:#18181b;"><strong>${safeSlot}</strong></td></tr>
            </table>
          </div>

          ${calendarUrl ? `
          <div style="margin:0 0 16px;">
            <a href="${calendarUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:500;">
              Add to Google Calendar
            </a>
          </div>
          ` : ""}

          <ul style="margin:0 0 16px;padding-left:18px;color:#3f3f46;font-size:14px;line-height:1.6;">
            <li>Please discuss which online meeting platform to use for the session.</li>
            <li>Don't forget to rate your mentor on the app afterwards.</li>
            <li>If the other person does not show up, please leave a review on the app so we can follow up.</li>
          </ul>
        </div>
        <div style="background:#f4f4f5;padding:16px 24px;border-top:1px solid #e4e4e7;">
          <p style="margin:0;color:#a1a1aa;font-size:12px;">— Peer Tutoring</p>
        </div>
      </div>
    </div>
  `;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 3;
const rateLimitHits = new Map<string, number[]>();

// In-memory only: resets on cold start and isn't shared across concurrent
// serverless instances. Stops casual abuse/accidental retries, not a
// determined distributed attacker.
function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (rateLimitHits.get(userId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  recent.push(now);
  rateLimitHits.set(userId, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

export async function POST(req: NextRequest) {
  const { studentName, mentorId, slot } = await req.json();

  const resendKey = process.env.RESEND_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!resendKey || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Email not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAuthClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userError } = await supabaseAuthClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authenticatedUser = userData.user;

  if (isRateLimited(authenticatedUser.id)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const studentEmail = authenticatedUser.email ?? "";

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: sessionRow } = await supabaseAdmin
    .from("sessions")
    .select("id")
    .eq("student_id", authenticatedUser.id)
    .eq("mentor_id", mentorId)
    .limit(1)
    .maybeSingle();

  if (!sessionRow) {
    return NextResponse.json({ error: "No matching session found" }, { status: 403 });
  }

  const { data: mentorRow } = await supabaseAdmin
    .from("profiles")
    .select("display_name, email")
    .eq("id", mentorId)
    .single();

  const mentorEmail = mentorRow?.email ?? "";
  const mentorName = mentorRow?.display_name ?? "";
  if (!studentEmail || !mentorEmail) {
    return NextResponse.json({ error: "Missing recipient email" }, { status: 400 });
  }

  const subject = `Peer Tutoring session requested — ${slot}`;
  const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const calendarUrl = buildCalendarUrl(slot, mentorName, studentName);

  const studentHtml = renderEmailHtml({
    greetingName: studentName,
    introLine: "Your tutoring session request has been sent! Your mentor still needs to accept it before it's confirmed.",
    mentorName,
    studentName,
    slot,
    calendarUrl,
  });

  const mentorHtml = renderEmailHtml({
    greetingName: mentorName,
    introLine: "A student has requested a tutoring session with you. Accept or decline the request from your dashboard.",
    mentorName,
    studentName,
    slot,
    calendarUrl,
  });

  async function sendOne(to: string, html: string) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromAddress, to, subject, html }),
    });
    return res.ok;
  }

  const results = await Promise.all([
    sendOne(studentEmail, studentHtml),
    sendOne(mentorEmail, mentorHtml),
  ]);

  if (results.every(Boolean)) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "One or more emails failed" }, { status: 500 });
}
