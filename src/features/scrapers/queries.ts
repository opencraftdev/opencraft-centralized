import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScraperCategory, ScraperLead } from "./types";

/** Raw shape of a `scraper_leads` row as returned by Supabase. */
type ScraperLeadRow = {
  id: string;
  category: ScraperCategory;
  business_name: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  address: string | null;
  rating: number | string | null;
  reviews: number | null;
  latitude: number | null;
  longitude: number | null;
  maps_url: string | null;
  query: string | null;
  location: string | null;
  scraped_at: string;
  validation_status: "pending" | "valid" | "invalid" | "needs_review" | null;
  marketing_angle: string | null;
  outreach_message: string | null;
  verified: boolean | null;
  verified_at: string | null;
};

function toLead(row: ScraperLeadRow): ScraperLead {
  return {
    id: row.id,
    category: row.category,
    businessName: row.business_name,
    phone: row.phone,
    website: row.website,
    email: row.email,
    address: row.address,
    // numeric columns can come back as strings over the wire — coerce.
    rating: row.rating == null ? null : Number(row.rating),
    reviews: row.reviews,
    latitude: row.latitude,
    longitude: row.longitude,
    mapsUrl: row.maps_url,
    query: row.query,
    location: row.location,
    scrapedAt: row.scraped_at,
    validationStatus: row.validation_status,
    marketingAngle: row.marketing_angle,
    outreachMessage: row.outreach_message,
    verified: row.verified ?? false,
    verifiedAt: row.verified_at,
  };
}

/** Load all scraped leads, most recently scraped first. */
export async function getScraperLeads(supabase: SupabaseClient): Promise<ScraperLead[]> {
  const { data, error } = await supabase
    .from("scraper_leads")
    .select(
      "id,category,business_name,phone,website,email,address,rating,reviews,latitude,longitude,maps_url,query,location,scraped_at,validation_status,marketing_angle,outreach_message,verified,verified_at",
    )
    .order("scraped_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => toLead(row as ScraperLeadRow));
}
