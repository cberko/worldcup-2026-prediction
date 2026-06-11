"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usernameToEmail, isValidUsername } from "@/lib/username";
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
            window.location.reload();
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

type Mode = "signin" | "signup";

function AuthModal({ onClose }: { onClose: () => void }) {
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!isValidUsername(username)) {
      setErr("Username must be 3–32 letters or numbers.");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    const email = usernameToEmail(username);
    setLoading(true);

    if (mode === "signup") {
      // Server-side sign-up (admin API, pre-confirmed) — no email is ever sent.
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setLoading(false);
        setErr(j.error ?? "Sign-up failed. Try again.");
        return;
      }
      const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
      if (e2) {
        setLoading(false);
        setErr("Account created. Please sign in.");
        setMode("signin");
        return;
      }
      window.location.reload();
      return;
    }

    // sign in
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setErr("Wrong username or password.");
      return;
    }
    window.location.reload();
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="card w-full max-w-sm animate-fade-up p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold">
          {mode === "signin" ? "Welcome back" : "Join the prediction league"}
        </h2>
        <p className="mt-1 text-sm text-emerald-100/60">
          {mode === "signin"
            ? "Sign in with your username and password."
            : "Pick a username and password — no email needed."}
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            className="w-full rounded-xl border border-white/10 bg-pitch-800/60 px-3 py-2 text-sm outline-none focus:border-grass-500/60"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="w-full rounded-xl border border-white/10 bg-pitch-800/60 px-3 py-2 text-sm outline-none focus:border-grass-500/60"
          />
          <button
            disabled={loading}
            className="w-full rounded-xl bg-grass-500 py-2 text-sm font-semibold text-pitch-950 transition hover:bg-grass-400 disabled:opacity-50"
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => {
            setErr(null);
            setMode((m) => (m === "signin" ? "signup" : "signin"));
          }}
          className="mt-3 w-full text-center text-xs text-emerald-100/55 transition hover:text-emerald-100/90"
        >
          {mode === "signin"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>

        {err && <p className="mt-3 text-sm text-rose-300">{err}</p>}

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
