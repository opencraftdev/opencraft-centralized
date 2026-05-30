'use client';

import { useState, useEffect } from 'react';
import { Box, Grid, Typography, Button, CircularProgress, Paper } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import AgentCard from '@/components/AgentCard';
import CreateAgentDialog from '@/components/CreateAgentDialog';
import { listAgents, setAgentStatus, deleteAgent } from '@/lib/agentService';

export default function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    setLoading(true);
    const { data, error } = await listAgents();
    if (!error && data) setAgents(data);
    setLoading(false);
  }

  async function handleToggle(agent) {
    const next = agent.status === 'active' ? 'paused' : 'active';
    const { data, error } = await setAgentStatus(agent.id, next);
    if (!error && data) {
      setAgents((prev) => prev.map((a) => (a.id === data.id ? data : a)));
    }
  }

  async function handleDelete(agent) {
    const { error } = await deleteAgent(agent.id);
    if (!error) setAgents((prev) => prev.filter((a) => a.id !== agent.id));
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Agents
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Create Agent
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : agents.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{ p: 6, textAlign: 'center', bgcolor: '#fff', borderStyle: 'dashed' }}
        >
          <SmartToyOutlinedIcon sx={{ fontSize: 48, color: '#9ca3af', mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            No agents yet
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Create an automation agent to start generating and scheduling posts.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Create your first agent
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {agents.map((agent) => (
            <Grid item xs={12} sm={6} md={4} key={agent.id}>
              <AgentCard agent={agent} onToggle={handleToggle} onDelete={handleDelete} />
            </Grid>
          ))}
        </Grid>
      )}

      <CreateAgentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={fetchAgents}
      />
    </Box>
  );
}
