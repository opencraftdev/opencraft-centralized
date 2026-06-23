"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import StarRounded from "@mui/icons-material/StarRounded";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import LanguageOutlined from "@mui/icons-material/LanguageOutlined";
import LaunchOutlined from "@mui/icons-material/LaunchOutlined";
import WhatsApp from "@mui/icons-material/WhatsApp";

import type { ScraperCategory, ScraperLead } from "../types";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  countByCategory,
  formatRating,
  summarize,
  whatsAppLink,
} from "../data";

type Filter = "all" | ScraperCategory;

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <Box
      sx={{
        flex: "1 1 0",
        minWidth: 140,
        bgcolor: "#fff",
        border: "1px solid #E8EAED",
        borderRadius: "12px",
        px: 2.5,
        py: 2,
      }}
    >
      <Typography sx={{ fontSize: "0.75rem", color: "#5f6368", fontWeight: 500 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: "1.75rem",
          fontWeight: 600,
          color: accent,
          lineHeight: 1.2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value.toLocaleString("id-ID")}
      </Typography>
    </Box>
  );
}

function CategoryTab({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        height: 36,
        px: 2,
        borderRadius: "9999px",
        cursor: "pointer",
        border: `1px solid ${active ? color : "#DADCE0"}`,
        bgcolor: active ? `${color}14` : "#fff",
        color: active ? color : "#444746",
        fontSize: "0.8125rem",
        fontWeight: active ? 600 : 500,
        transition: "all 120ms ease",
        "&:hover": { bgcolor: active ? `${color}22` : "#F8FAFD" },
      }}
    >
      {label}
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 20,
          height: 20,
          px: 0.75,
          borderRadius: "9999px",
          bgcolor: active ? color : "#E8EAED",
          color: active ? "#fff" : "#5f6368",
          fontSize: "0.6875rem",
          fontWeight: 600,
        }}
      >
        {count}
      </Box>
    </Box>
  );
}

function ContactCell({ lead }: { lead: ScraperLead }) {
  const hasAny = lead.email || lead.phone || lead.website;
  if (!hasAny) {
    return <Typography sx={{ fontSize: "0.8125rem", color: "#bdc1c6" }}>—</Typography>;
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      {lead.email && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <EmailOutlined sx={{ fontSize: 15, color: "#0B57D0" }} />
          <Typography
            component="a"
            href={`mailto:${lead.email}`}
            sx={{ fontSize: "0.8125rem", color: "#0B57D0", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
          >
            {lead.email}
          </Typography>
        </Box>
      )}
      {lead.phone && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <PhoneOutlined sx={{ fontSize: 15, color: "#5f6368" }} />
          <Typography sx={{ fontSize: "0.8125rem", color: "#3c4043" }}>{lead.phone}</Typography>
        </Box>
      )}
      {lead.website && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <LanguageOutlined sx={{ fontSize: 15, color: "#5f6368" }} />
          <Typography
            component="a"
            href={lead.website}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ fontSize: "0.8125rem", color: "#3c4043", textDecoration: "none", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", "&:hover": { textDecoration: "underline" } }}
          >
            {lead.website.replace(/^https?:\/\/(www\.)?/, "")}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

/** Click-to-chat WhatsApp button. Opens wa.me with the lead's number and the
 *  `/validate` outreach message prefilled. Hidden (—) when there's no usable phone. */
function WhatsAppCell({ lead }: { lead: ScraperLead }) {
  const href = whatsAppLink(lead.phone, lead.outreachMessage);
  if (!href) {
    return <Typography sx={{ fontSize: "0.8125rem", color: "#bdc1c6" }}>—</Typography>;
  }
  const hasMessage = !!lead.outreachMessage;
  const tooltip = hasMessage
    ? lead.outreachMessage!.slice(0, 180) + (lead.outreachMessage!.length > 180 ? "…" : "")
    : "Buka chat WhatsApp (belum ada pesan outreach — jalankan /validate dulu)";
  return (
    <Tooltip title={tooltip} arrow placement="top">
      <Box
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          height: 32,
          px: 1.5,
          borderRadius: "9999px",
          textDecoration: "none",
          bgcolor: hasMessage ? "#25D366" : "#fff",
          color: hasMessage ? "#fff" : "#25D366",
          border: "1px solid #25D366",
          fontSize: "0.75rem",
          fontWeight: 600,
          whiteSpace: "nowrap",
          transition: "all 120ms ease",
          "&:hover": { bgcolor: hasMessage ? "#1EBE5A" : "#25D36614" },
        }}
      >
        <WhatsApp sx={{ fontSize: 16 }} />
        Chat
      </Box>
    </Tooltip>
  );
}

export function ScrapersView({ leads }: { leads: ScraperLead[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => countByCategory(leads), [leads]);
  const visible = useMemo(
    () => (filter === "all" ? leads : leads.filter((l) => l.category === filter)),
    [leads, filter],
  );
  const summary = useMemo(() => summarize(visible), [visible]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Summary cards */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <SummaryCard label="Total leads" value={summary.total} accent="#202124" />
        <SummaryCard label="With email" value={summary.withEmail} accent="#0B57D0" />
        <SummaryCard label="With phone" value={summary.withPhone} accent="#188038" />
        <SummaryCard label="With website" value={summary.withWebsite} accent="#E37400" />
      </Box>

      {/* Category tabs */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <CategoryTab
          label="All"
          count={leads.length}
          color="#0B57D0"
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        {CATEGORY_ORDER.map((c) => (
          <CategoryTab
            key={c}
            label={CATEGORY_META[c].label}
            count={counts[c]}
            color={CATEGORY_META[c].color}
            active={filter === c}
            onClick={() => setFilter(c)}
          />
        ))}
      </Box>

      {/* Leads table */}
      <Box sx={{ bgcolor: "#fff", borderRadius: "12px", border: "1px solid #E8EAED", overflow: "hidden" }}>
        {visible.length === 0 ? (
          <Box sx={{ px: 3, py: 8, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.9375rem", color: "#5f6368" }}>
              No leads scraped yet for this category.
            </Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#9aa0a6", mt: 0.5 }}>
              Run <code>/scrape</code> in the cold-email-automation repo to populate leads.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table sx={{ minWidth: 860 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Business</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell align="center">Rating</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell align="center">Maps</TableCell>
                  <TableCell align="center">Outreach</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.map((lead) => {
                  const cat = CATEGORY_META[lead.category];
                  return (
                    <TableRow key={lead.id} hover sx={{ "&:hover": { bgcolor: "#F8FAFD" }, verticalAlign: "top" }}>
                      <TableCell>
                        <Typography sx={{ fontSize: "0.8125rem", color: "#202124", fontWeight: 500 }}>
                          {lead.businessName}
                        </Typography>
                        {lead.address && (
                          <Typography sx={{ fontSize: "0.6875rem", color: "#80868b", maxWidth: 240 }}>
                            {lead.address}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={cat.label}
                          sx={{
                            bgcolor: `${cat.color}14`,
                            color: cat.color,
                            border: `1px solid ${cat.color}33`,
                            "& .MuiChip-label": { px: 1 },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <ContactCell lead={lead} />
                      </TableCell>
                      <TableCell align="center">
                        {lead.rating == null ? (
                          <Typography sx={{ fontSize: "0.8125rem", color: "#bdc1c6" }}>—</Typography>
                        ) : (
                          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
                            <StarRounded sx={{ fontSize: 16, color: "#F9AB00" }} />
                            <Typography sx={{ fontSize: "0.8125rem", color: "#202124", fontWeight: 500 }}>
                              {formatRating(lead.rating)}
                            </Typography>
                            {lead.reviews != null && (
                              <Typography sx={{ fontSize: "0.6875rem", color: "#80868b" }}>
                                ({lead.reviews})
                              </Typography>
                            )}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368" }}>
                          {lead.location ?? "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {lead.mapsUrl ? (
                          <Box
                            component="a"
                            href={lead.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ display: "inline-flex", color: "#0B57D0" }}
                          >
                            <LaunchOutlined sx={{ fontSize: 18 }} />
                          </Box>
                        ) : (
                          <Typography sx={{ fontSize: "0.8125rem", color: "#bdc1c6" }}>—</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <WhatsAppCell lead={lead} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
}
