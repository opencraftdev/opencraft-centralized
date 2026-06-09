import { BlogsShell } from "@/features/seo/components/BlogsShell";
import { PerformanceTab } from "@/features/seo/components/PerformanceTab";
import { getSearchPerformance } from "@/lib/seo/search-console";

export const dynamic = "force-dynamic";

export default async function BlogPerformancePage() {
  const search = await getSearchPerformance();
  const subtitle = search.connected
    ? `Search performance & Core Web Vitals · ${search.range?.start} → ${search.range?.end}`
    : "Search performance & Core Web Vitals · ocraft.id";

  return (
    <BlogsShell title="Performance" subtitle={subtitle}>
      <PerformanceTab search={search} />
    </BlogsShell>
  );
}
