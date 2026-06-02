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

// Two views under "Record Video":
//   • Record       — the screen/webcam recorder + renders library (unchanged)
//   • AI News Brief — read-only list of briefs published by the video-materials agent
// The recorder stays mounted across tab switches (display toggle, not unmount) so
// an in-progress recording/upload is never lost when you peek at the briefs.
export function RecordVideoTabs({
  initialVideos,
  initialUsage,
  initialBriefs,
}: {
  initialVideos: TutorialVideoRow[];
  initialUsage: CreditUsage | null;
  initialBriefs: NewsBriefRow[];
}) {
  const [tab, setTab] = useState(0);

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
          <Tab icon={<VideocamOutlined sx={{ fontSize: 20 }} />} iconPosition="start" label="Record" />
          <Tab
            icon={<NewspaperOutlined sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Brief"
          />
        </Tabs>
      </Box>

      {/* Keep the recorder mounted; just hide it when another tab is active so an
          in-progress recording/upload is never lost when you peek elsewhere. */}
      <Box sx={{ display: tab === 0 ? "block" : "none" }}>
        <RecordTutorialClient initialVideos={initialVideos} initialUsage={initialUsage} />
      </Box>
      {tab === 1 && <MaterialsList briefs={initialBriefs} />}
    </Box>
  );
}
