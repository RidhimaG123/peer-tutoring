import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { studentEmail, studentName, mentorEmail, mentorName, slot } =
    await req.json();

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "Email not configured" }, { status: 500 });
  }

  const subject = `Peer Tutoring session requested — ${slot}`;
  const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const studentHtml = `
    <p>Hi ${studentName || "there"},</p>
    <p>Your tutoring session request has been sent! Your mentor still needs to accept it before it's confirmed.</p>
    <table style="border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:4px 12px 4px 0;color:#555">Mentor</td><td><strong>${mentorName || "your mentor"}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">Time slot</td><td><strong>${slot}</strong></td></tr>
    </table>
    <p style="background:#f4f4f0;padding:12px 16px;border-radius:8px">
      Once your mentor accepts, discuss where to meet for the session and don't forget to rate your mentor afterwards.
    </p>
    <p style="color:#888;font-size:13px">— Peer Tutoring</p>
  `;

  const mentorHtml = `
    <p>Hi ${mentorName || "there"},</p>
    <p>A student has requested a tutoring session with you.</p>
    <table style="border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:4px 12px 4px 0;color:#555">Student</td><td><strong>${studentName || "a student"}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">Time slot</td><td><strong>${slot}</strong></td></tr>
    </table>
    <p style="background:#f4f4f0;padding:12px 16px;border-radius:8px">
      Accept or decline the request from your dashboard. Once accepted, discuss where to meet for the session.
    </p>
    <p style="color:#888;font-size:13px">— Peer Tutoring</p>
  `;

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
