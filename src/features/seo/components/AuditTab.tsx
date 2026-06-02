"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import HelpOutline from "@mui/icons-material/HelpOutlineOutlined";
import ErrorOutline from "@mui/icons-material/ErrorOutlineOutlined";
import WarningAmberOutlined from "@mui/icons-material/WarningAmberOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { auditSnapshot, type Severity, type Finding } from "../mock";

const CARD_SX = {
  bgcolor: "#fff",
  borderRadius: "12px",
  border: "1px solid #E8EAED",
} as const;

// 0-100 → color band (claude-seo style).
function scoreColor(score: number): string {
  if (score >= 80) return "#188038";
  if (score >= 50) return "#F9AB00";
  return "#D93025";
}
function scoreGrade(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 65) return "Needs work";
  if (score >= 50) return "Poor";
  return "Critical";
}

const SEVERITY_META: Record<
  Severity,
  { color: string; label: string; Icon: typeof ErrorOutline }
> = {
  critical: { color: "#D93025", label: "Critical", Icon: ErrorOutline },
  high: { color: "#E8710A", label: "High", Icon: WarningAmberOutlined },
  medium: { color: "#F9AB00", label: "Medium", Icon: WarningAmberOutlined },
  low: { color: "#5F6368", label: "Low", Icon: InfoOutlined },
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

// GSC "Page indexing"–style flat tile.
function SummaryTile({
  label,
  value,
  sub,
  bg,
}: {
  label: string;
  value: string;
  sub: string;
  bg: string;
}) {
  return (
    <Box
      sx={{
        position: "relative",
        flex: 1,
        bgcolor: bg,
        px: 2.5,
        py: 2,
        minHeight: 120,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Typography sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.92)" }}>
        {label}
      </Typography>
      <Box>
        <Typography sx={{ fontSize: "2.25rem", fontWeight: 400, lineHeight: 1, color: "#fff" }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.78)", mt: 0.75 }}>
          {sub}
        </Typography>
      </Box>
      <HelpOutline
        sx={{ position: "absolute", right: 12, bottom: 12, fontSize: 16, color: "rgba(255,255,255,0.6)" }}
      />
    </Box>
  );
}

function CategoryBar({ label, weight, score }: { label: string; weight: number; score: number }) {
  const color = scoreColor(score);
  return (
    <Box sx={{ py: 1.25 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mb: 0.75 }}>
        <Typography sx={{ fontSize: "0.875rem", color: "#3C4043" }}>
          {label}
          <Typography component="span" sx={{ fontSize: "0.6875rem", color: "#9AA0A6", ml: 0.75 }}>
            {weight}% weight
          </Typography>
        </Typography>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color }}>{score}</Typography>
      </Box>
      <Box sx={{ height: 6, borderRadius: 3, bgcolor: "#F1F3F4", overflow: "hidden" }}>
        <Box sx={{ height: "100%", width: `${score}%`, bgcolor: color, borderRadius: 3 }} />
      </Box>
    </Box>
  );
}

const ISSUE_COLS = "minmax(0, 1fr) 130px 120px 150px";
const headSx = {
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "#5F6368",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
} as const;

function IssueRow({ finding }: { finding: Finding }) {
  const meta = SEVERITY_META[finding.severity];
  const { Icon } = meta;
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: ISSUE_COLS,
        gap: 2,
        alignItems: "center",
        px: 2.5,
        py: 1.75,
        borderTop: "1px solid #F1F3F4",
        "&:hover": { bgcolor: "#F8F9FA" },
      }}
    >
      <Typography sx={{ fontSize: "0.875rem", color: "#3C4043" }}>{finding.message}</Typography>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
        <Icon sx={{ fontSize: 18, color: meta.color }} />
        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500, color: meta.color }}>
          {meta.label}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368" }}>{finding.page}</Typography>
      <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368" }}>{finding.category}</Typography>
    </Box>
  );
}

export function AuditTab() {
  const { overallScore, auditedAt, categories, findings, pages, site } = auditSnapshot;
  const sortedFindings = [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
  const healthy = categories.filter((c) => c.score >= 80).length;
  const dateLabel = new Date(auditedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Summary card — GSC Page-indexing style tiles */}
      <Box sx={{ ...CARD_SX, p: 3 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
            mb: 2,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: "1.125rem", fontWeight: 500, color: "#1F1F1F" }}>
              SEO health · {scoreGrade(overallScore)}
            </Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368" }}>
              {site} · claude-seo grading across 7 weighted categories
            </Typography>
          </Box>
          <Typography sx={{ fontSize: "0.75rem", color: "#9AA0A6" }}>
            Last audited {dateLabel} · Firecrawl crawl
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: "2px", borderRadius: "12px", overflow: "hidden" }}>
          <SummaryTile
            label="Health score"
            value={String(overallScore)}
            sub="out of 100"
            bg={scoreColor(overallScore)}
          />
          <SummaryTile
            label="Issues found"
            value={String(findings.length)}
            sub={`across ${pages.length} pages`}
            bg="#5f6368"
          />
          <SummaryTile
            label="Categories healthy"
            value={`${healthy}/${categories.length}`}
            sub="scoring 80+"
            bg="#188038"
          />
        </Box>
      </Box>

      {/* Category breakdown + per-page scores */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Box sx={{ ...CARD_SX, flex: "2 1 380px", minWidth: 320, p: 3 }}>
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: "#1F1F1F", mb: 1 }}>
            Category scores
          </Typography>
          {categories.map((c) => (
            <CategoryBar key={c.key} label={c.label} weight={c.weight} score={c.score} />
          ))}
        </Box>

        <Box sx={{ ...CARD_SX, flex: "1 1 240px", minWidth: 220, overflow: "hidden" }}>
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: "#1F1F1F", px: 2.5, py: 2 }}>
            Pages audited
          </Typography>
          {pages.map((p) => (
            <Box
              key={p.path}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                px: 2.5,
                py: 1.5,
                borderTop: "1px solid #F1F3F4",
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.8125rem",
                  color: "#3C4043",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p.path}
              </Typography>
              <Box
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#fff",
                  bgcolor: scoreColor(p.score),
                  px: 1,
                  py: 0.25,
                  borderRadius: "6px",
                  flexShrink: 0,
                }}
              >
                {p.score}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Issues table — GSC "Improve page appearance" style */}
      <Box sx={{ ...CARD_SX, overflow: "hidden" }}>
        <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>
          <Typography sx={{ fontSize: "1.0625rem", fontWeight: 500, color: "#1F1F1F" }}>
            Issues &amp; action plan
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368" }}>
            Findings ranked by severity — fix Critical first.
          </Typography>
        </Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: ISSUE_COLS,
            gap: 2,
            px: 2.5,
            py: 1,
            borderTop: "1px solid #E8EAED",
          }}
        >
          <Typography sx={headSx}>Issue</Typography>
          <Typography sx={headSx}>Severity</Typography>
          <Typography sx={headSx}>Page</Typography>
          <Typography sx={headSx}>Category</Typography>
        </Box>
        {sortedFindings.map((f, i) => (
          <IssueRow key={i} finding={f} />
        ))}
      </Box>
    </Box>
  );
}
