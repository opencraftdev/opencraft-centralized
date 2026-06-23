import type { ScraperCategory, ScraperLead, ScraperSummary } from "./types";

/** Display label + accent colour per category, in the order shown in the UI. */
export const CATEGORY_META: Record<ScraperCategory, { label: string; color: string }> = {
  kecantikan: { label: "Kecantikan", color: "#D81B60" },      // beauty — pink
  wisata: { label: "Wisata", color: "#1E88E5" },              // tourism — blue
  otomotif: { label: "Otomotif", color: "#546E7A" },          // automotive — slate
  akomodasi: { label: "Akomodasi", color: "#8E24AA" },        // accommodation — purple
  kesehatan: { label: "Kesehatan", color: "#188038" },        // health — green
  "korean-market": { label: "Korean Market", color: "#E37400" }, // korean market — orange
};

/** Categories in display order. */
export const CATEGORY_ORDER: ScraperCategory[] = [
  "kecantikan",
  "wisata",
  "otomotif",
  "akomodasi",
  "kesehatan",
  "korean-market",
];

export function summarize(leads: ScraperLead[]): ScraperSummary {
  return {
    total: leads.length,
    withEmail: leads.filter((l) => !!l.email).length,
    withPhone: leads.filter((l) => !!l.phone).length,
    withWebsite: leads.filter((l) => !!l.website).length,
  };
}

/** Count of leads per category, used for the category tab badges. */
export function countByCategory(leads: ScraperLead[]): Record<ScraperCategory, number> {
  const counts = Object.fromEntries(
    CATEGORY_ORDER.map((c) => [c, 0]),
  ) as Record<ScraperCategory, number>;
  for (const lead of leads) counts[lead.category]++;
  return counts;
}

/** Format a 0–5 rating for display, or "—" when unrated. */
export function formatRating(rating: number | null): string {
  return rating == null ? "—" : rating.toFixed(1);
}

/** Normalise a raw scraped phone number to wa.me digits (E.164 without the `+`).
 *  Indonesian-aware: a leading `0` or bare `8…` mobile is prefixed with `62`.
 *  Returns null if there aren't enough digits to be a real number. */
export function toWhatsAppNumber(phone: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;        // 0812… → 62812…
  else if (digits.startsWith("8")) digits = `62${digits}`;            // 812… → 62812…
  // (numbers already starting with a country code, e.g. 62…, are left as-is)
  return digits.length >= 8 ? digits : null;
}

/** Build a click-to-chat wa.me URL from a lead's phone + an optional prefilled
 *  message (the `/validate` outreach message). Returns null when the phone
 *  can't be normalised — the UI hides the button in that case. */
export function whatsAppLink(phone: string | null, message?: string | null): string | null {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
