import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

type VerifyResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 | 500 };

export async function verifyAdmin(req: NextRequest): Promise<VerifyResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { ok: false, status: 500 };
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { ok: false, status: 401 };
  }

  const supabaseAuthClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userError } = await supabaseAuthClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return { ok: false, status: 401 };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { data: callerProfile, error: callerError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (callerError || callerProfile?.role !== "admin") {
    return { ok: false, status: 403 };
  }

  return { ok: true, userId: userData.user.id };
}
