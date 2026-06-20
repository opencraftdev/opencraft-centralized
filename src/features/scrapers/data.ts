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
