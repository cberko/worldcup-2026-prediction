// Username ⇄ synthetic-email mapping.
//
// Supabase Auth has no native "username" login — identities are email/phone/anon.
// So we give every account a DETERMINISTIC synthetic email derived from its
// username: `<slug>@wcpredict.app`. Login becomes: username → that email + password.
// No real email is ever sent, so the email rate limit can never be hit.
//
// IMPORTANT: this exact slug logic is shared by the sign-up/sign-in UI and the
// one-off migration script (`sim/migrate-auth.mjs`) — they must agree byte-for-byte.

export const USERNAME_EMAIL_DOMAIN = "wcpredict.app";

const TR_MAP: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
  Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u",
};

/** Normalize a display username to a slug usable as an email local-part. */
export function slugifyUsername(raw: string): string {
  return (raw || "")
    .trim()
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR_MAP[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip remaining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "") // letters+digits only
    .slice(0, 32);
}

/** Whether a raw username is acceptable for a NEW sign-up. */
export function isValidUsername(raw: string): boolean {
  const s = slugifyUsername(raw);
  return s.length >= 3 && s.length <= 32;
}

/** Deterministic auth email for a username. */
export function usernameToEmail(raw: string): string {
  return `${slugifyUsername(raw)}@${USERNAME_EMAIL_DOMAIN}`;
}
