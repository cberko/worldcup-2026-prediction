import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUsername, slugifyUsername, usernameToEmail } from "@/lib/username";

export const dynamic = "force-dynamic";

// Server-side sign-up via the admin API with `email_confirm: true`, so no
// confirmation email is ever sent — the email rate limit can never be hit.
// The client signs in with username+password immediately afterwards.
export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: "Username must be 3–32 letters or numbers." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { display_name: username },
  });

  if (error) {
    const taken =
      error.code === "email_exists" || /already.*(registered|exists)/i.test(error.message);
    return NextResponse.json(
      { error: taken ? "That username is taken — try another or sign in." : error.message },
      { status: taken ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true, username: slugifyUsername(username) });
}
