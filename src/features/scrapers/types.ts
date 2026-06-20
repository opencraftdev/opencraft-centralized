/** The six tracked Google Maps business categories. Slugs match the
 *  `category` check constraint on the `scraper_leads` table. */
export type ScraperCategory =
  | "kecantikan"
  | "wisata"
  | "otomotif"
  | "akomodasi"
  | "kesehatan"
  | "korean-market";

export type ScraperLead = {
  id: string;
  category: ScraperCategory;
  businessName: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  address: string | null;
  /** 0.0–5.0 Google rating, or null if unrated. */
  rating: number | null;
  reviews: number | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  /** The search query that produced this lead, e.g. "klinik kecantikan in Jakarta". */
  query: string | null;
  /** City / area searched. */
  location: string | null;
  scrapedAt: string;
};

/** Aggregate counts for a set of leads — drives the summary cards. */
export type ScraperSummary = {
  total: number;
  withEmail: number;
  withPhone: number;
  withWebsite: number;
};
