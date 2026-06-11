"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);

  // Create the browser client only on the client (keeps SSR/build env-free).
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    // Let any component prompt sign-in via window.dispatchEvent(new Event("open-auth"))
    const openHandler = () => setOpen(true);
    window.addEventListener("open-auth", openHandler);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("open-auth", openHandler);
    };
  }, []);

  if (user) {
    const name =
      (user.user_metadata?.display_name as string) ||
      (user.user_metadata?.full_name as string) ||
      user.email?.split("@")[0] ||
      "Player";
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-emerald-100/80 sm:inline">
          Hi, <span className="font-semibold text-white">{name}</span>
        </span>
        <button
          onClick={async () => {
            await createClient().auth.signOut();
          }}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-emerald-100/80 transition hover:bg-white/5"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-grass-500 px-4 py-1.5 text-sm font-semibold text-pitch-950 transition hover:bg-grass-400"
      >
        Sign In
      </button>
      {open && <AuthModal onClose={() => setOpen(false)} />}
    </>
  );
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setRateLimited(false);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        data: name ? { display_name: name } : undefined,
      },
    });
    setLoading(false);
    if (error) {
      // Supabase's built-in email service is tightly rate-limited (≈2/hour). Steer
      // users to the email-free options instead of showing a raw error.
      if (error.code === "over_email_send_rate_limit" || error.status === 429) {
        setRateLimited(true);
        setErr("Magic-link emails are temporarily rate-limited. Use Google or continue as a guest below — no email needed.");
      } else {
        setErr(error.message);
      }
    } else setSent(true);
  }

  async function google() {
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) setErr(error.message);
  }

  // One-click guest account (great for local testing). Requires Anonymous
  // sign-ins to be enabled in Supabase → Authentication → Sign In / Providers.
  async function guest() {
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { display_name: name || "Guest" } },
    });
    setLoading(false);
    if (error) setErr(error.message);
    else onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm animate-fade-up p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold">Join the prediction league</h2>
        <p className="mt-1 text-sm text-emerald-100/60">
          We&apos;ll email you a magic sign-in link. No password needed.
        </p>

        {sent ? (
          <div className="mt-5 rounded-xl border border-grass-500/30 bg-grass-500/10 p-4 text-sm">
            📬 A sign-in link was sent to <b>{email}</b>. Click the link in your email.
          </div>
        ) : (
          <>
            <form onSubmit={sendMagicLink} className="mt-5 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display name (e.g. Berke)"
                className="w-full rounded-xl border border-white/10 bg-pitch-800/60 px-3 py-2 text-sm outline-none focus:border-grass-500/60"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-pitch-800/60 px-3 py-2 text-sm outline-none focus:border-grass-500/60"
              />
              <button
                disabled={loading}
                className="w-full rounded-xl bg-grass-500 py-2 text-sm font-semibold text-pitch-950 transition hover:bg-grass-400 disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send sign-in link"}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3 text-xs text-emerald-100/40">
              <span className="h-px flex-1 bg-white/10" /> or{" "}
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              onClick={google}
              className="w-full rounded-xl border border-white/10 py-2 text-sm font-medium transition hover:bg-white/5"
            >
              Continue with Google
            </button>

            <button
              onClick={guest}
              disabled={loading}
              className={`mt-2 w-full rounded-xl py-2 text-sm font-medium transition disabled:opacity-50 ${
                rateLimited
                  ? "bg-grass-500 font-semibold text-pitch-950 hover:bg-grass-400"
                  : "border border-white/10 text-emerald-100/70 hover:bg-white/5"
              }`}
            >
              Continue as guest{rateLimited ? " — no email needed" : ""}
            </button>
          </>
        )}

        {err && (
          <p className={`mt-3 text-sm ${rateLimited ? "text-gold-300" : "text-rose-300"}`}>{err}</p>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-xs text-emerald-100/40 hover:text-emerald-100/70"
        >
          Close
        </button>
      </div>
    </div>
  );
}
