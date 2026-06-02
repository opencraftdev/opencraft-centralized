import { BlogsShell } from "@/features/seo/components/BlogsShell";
import { AuditTab } from "@/features/seo/components/AuditTab";

export default function BlogAuditPage() {
  return (
    <BlogsShell title="SEO Audit" subtitle="Firecrawl + claude-seo grading · ocraft.id">
      <AuditTab />
    </BlogsShell>
  );
}
