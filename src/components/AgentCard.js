'use client';

import { Card, CardContent, Typography, Chip, Box, Stack, IconButton, Tooltip } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { platformLabel, FREQUENCIES } from '@/lib/platforms';

function frequencyLabel(value) {
  return FREQUENCIES.find((f) => f.value === value)?.label || value;
}

export default function AgentCard({ agent, onToggle, onDelete }) {
  const active = agent.status === 'active';

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {agent.name}
          </Typography>
          <Chip
            label={active ? 'Active' : 'Paused'}
            size="small"
            color={active ? 'success' : 'default'}
          />
        </Box>

        <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
          <Chip label={platformLabel(agent.platform)} size="small" variant="outlined" />
          <Chip label={frequencyLabel(agent.frequency)} size="small" variant="outlined" />
        </Stack>

        {agent.persona && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {agent.persona}
          </Typography>
        )}

        {agent.topics?.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
            {agent.topics.map((t) => (
              <Chip key={t} label={t} size="small" />
            ))}
          </Stack>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Tooltip title={active ? 'Pause agent' : 'Activate agent'}>
            <IconButton size="small" onClick={() => onToggle?.(agent)}>
              {active ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete agent">
            <IconButton size="small" onClick={() => onDelete?.(agent)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );
}
