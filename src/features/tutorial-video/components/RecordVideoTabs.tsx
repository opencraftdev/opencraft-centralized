"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import VideocamOutlined from "@mui/icons-material/VideocamOutlined";
import NewspaperOutlined from "@mui/icons-material/NewspaperOutlined";
import { RecordTutorialClient } from "./RecordTutorialClient";
import { MaterialsList } from "@/features/news-materials/components/MaterialsList";
import type { CreditUsage, TutorialVideoRow } from "../types";
import type { NewsBriefRow } from "@/features/news-materials/types";

// A brief the user picked in the Brief tab, plus the presenter they chose for it.
// Lifted to this parent so the Record tab can read it after the auto tab-switch.
export type SelectedBrief = { brief: NewsBriefRow; presenterId: string };

// Two views under "Record Video":
//   • Brief   — list of briefs published by the video-materials agent; brief-first,
//               so this is the default tab. Picking a brief here selects it and
//               jumps to the Record tab.
//   • Record  — shows the selected brief, opens the desktop recorder (teleprompter),
//               then uploads + renders the finished clip.
// The recorder stays mounted across tab switches (display toggle, not unmount) so
// an in-progress recording/upload is never lost when you switch to the Brief tab.
//   tab 0 = Brief, tab 1 = Record
export function RecordVideoTabs({
  initialVideos,
  initialUsage,
  initialBriefs,
}: {
  initialVideos: TutorialVideoRow[];
  initialUsage: CreditUsage | null;
  initialBriefs: NewsBriefRow[];
}) {
  const [tab, setTab] = useState(0); // Brief tab first (brief-first workflow)
  const [selected, setSelected] = useState<SelectedBrief | null>(null);

  // Brief tab → "Record this brief": remember the choice and jump to Record.
  const handleSelect = (brief: NewsBriefRow, presenterId: string) => {
    setSelected({ brief, presenterId });
    setTab(1);
  };

  return (
    <Box>
      <Box sx={{ borderBottom: "1px solid #E8EAED", mb: 2.5 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            minHeight: 44,
            "& .MuiTab-root": {
              minHeight: 44,
              textTransform: "none",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#5F6368",
            },
            "& .Mui-selected": { color: "#0B57D0 !important" },
            "& .MuiTabs-indicator": { backgroundColor: "#0B57D0" },
          }}
        >
          <Tab
            icon={<NewspaperOutlined sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Brief"
          />
          <Tab icon={<VideocamOutlined sx={{ fontSize: 20 }} />} iconPosition="start" label="Record" />
        </Tabs>
      </Box>

      {/* Brief tab (default) mounts on demand. Picking a brief selects it + jumps. */}
      {tab === 0 && (
        <MaterialsList
          briefs={initialBriefs}
          selectedId={selected?.brief.id ?? null}
          onSelect={handleSelect}
        />
      )}
      {/* Keep the recorder mounted; just hide it when the Brief tab is active so an
          in-progress recording/upload is never lost when you switch tabs. */}
      <Box sx={{ display: tab === 1 ? "block" : "none" }}>
        <RecordTutorialClient
          initialVideos={initialVideos}
          initialUsage={initialUsage}
          selected={selected}
          onPickBrief={() => setTab(0)}
        />
      </Box>
    </Box>
  );
}
