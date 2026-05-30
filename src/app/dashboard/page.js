'use client';

import { useState, useEffect } from 'react';
import { Box, Grid, Typography, CircularProgress, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import StatCard from '@/components/StatCard';
import PostCard from '@/components/PostCard';
import CreateAgentDialog from '@/components/CreateAgentDialog';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stats, setStats] = useState({ agents: 0, total: 0, published: 0, scheduled: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [postsRes, agentsRes] = await Promise.all([
      supabase.from('posts').select('*').order('created_at', { ascending: false }),
      supabase.from('agents').select('id, status'),
    ]);

    const data = postsRes.data || [];
    setPosts(data);
    setStats({
      agents: (agentsRes.data || []).filter((a) => a.status === 'active').length,
      total: data.length,
      published: data.filter((p) => p.status === 'published').length,
      scheduled: data.filter((p) => p.status === 'scheduled').length,
    });
    setLoading(false);
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Dashboard
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Create Agent
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard title="Active Agents" value={stats.agents} color="#6366f1" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard title="Total Posts" value={stats.total} color="#0ea5e9" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard title="Published" value={stats.published} color="#10b981" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard title="Scheduled" value={stats.scheduled} color="#f59e0b" />
            </Grid>
          </Grid>

          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Recent Posts
          </Typography>
          <Grid container spacing={2}>
            {posts.map((post) => (
              <Grid item xs={12} sm={6} md={4} key={post.id}>
                <PostCard post={post} />
              </Grid>
            ))}
            {posts.length === 0 && (
              <Typography color="text.secondary" sx={{ ml: 2 }}>
                No posts yet. Create an agent to start automating.
              </Typography>
            )}
          </Grid>
        </>
      )}

      <CreateAgentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={fetchData}
      />
    </Box>
  );
}
