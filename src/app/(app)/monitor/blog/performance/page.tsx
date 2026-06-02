import { BlogsShell } from "@/features/seo/components/BlogsShell";
import { PerformanceTab } from "@/features/seo/components/PerformanceTab";

export default function BlogPerformancePage() {
  return (
    <BlogsShell title="Performance" subtitle="Search performance & Core Web Vitals · ocraft.id">
      <PerformanceTab />
    </BlogsShell>
  );
}
