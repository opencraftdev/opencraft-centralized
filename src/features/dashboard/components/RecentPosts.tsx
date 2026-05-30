import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import type { RecentPost } from "../queries";

const STATUS_COLORS: Record<string, { bgcolor: string; color: string }> = {
  draft:     { bgcolor: "rgba(95,99,104,0.08)",  color: "#5f6368" },
  accepted:  { bgcolor: "rgba(227,116,0,0.08)",  color: "#e37400" },
  scheduled: { bgcolor: "rgba(26,115,232,0.08)", color: "#1a73e8" },
  published: { bgcolor: "rgba(24,128,56,0.08)",  color: "#188038" },
  failed:    { bgcolor: "rgba(217,48,37,0.08)",  color: "#d93025" },
};

const TYPE_DOT_COLORS: Record<string, string> = {
  engage:  "#4285f4",
  educate: "#34a853",
  video:   "#5f6368",
};

export function RecentPosts({ posts }: { posts: RecentPost[] }) {
  if (posts.length === 0) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 6 }}>
        <Typography variant="body2" color="text.secondary">No posts yet</Typography>
      </Box>
    );
  }

  return (
    <List disablePadding>
      {posts.map((post, i) => {
        const statusStyle = STATUS_COLORS[post.status] ?? {};
        return (
          <Box key={post.id}>
            {i > 0 && <Divider />}
            <ListItemButton
              component={Link}
              href={`/posts/${post.id}`}
              sx={{ px: 2.5, py: 1.5, gap: 2, borderRadius: 0 }}
            >
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, bgcolor: TYPE_DOT_COLORS[post.type] ?? "#9aa0a6" }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {post.headline ?? (post.type === "engage" ? "Engage Post" : post.type === "educate" ? "Educate Post" : "Video Post")}
                </Typography>
                <Typography variant="caption">
                  {post.type.charAt(0).toUpperCase() + post.type.slice(1)} · {post.dateSlot}
                </Typography>
              </Box>
              <Chip
                label={post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                size="small"
                sx={{ ...statusStyle, flexShrink: 0 }}
              />
              <Typography variant="caption" sx={{ flexShrink: 0, width: 80, textAlign: "right" }}>
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </Typography>
            </ListItemButton>
          </Box>
        );
      })}
    </List>
  );
}
