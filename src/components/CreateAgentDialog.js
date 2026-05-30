'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Button,
  Box,
  Stack,
  Chip,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import { PLATFORMS, FREQUENCIES } from '@/lib/platforms';
import { createAgent } from '@/lib/agentService';

const EMPTY = {
  name: '',
  platform: 'twitter',
  persona: '',
  frequency: 'daily',
  active: true,
};

export default function CreateAgentDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [topicInput, setTopicInput] = useState('');
  const [topics, setTopics] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function addTopic() {
    const t = topicInput.trim();
    if (t && !topics.includes(t)) setTopics((prev) => [...prev, t]);
    setTopicInput('');
  }

  function handleTopicKey(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTopic();
    }
  }

  function reset() {
    setForm(EMPTY);
    setTopics([]);
    setTopicInput('');
    setError('');
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      setError('Give your agent a name.');
      return;
    }
    setSaving(true);
    setError('');
    const { data, error: err } = await createAgent({
      name: form.name,
      platform: form.platform,
      persona: form.persona,
      topics,
      frequency: form.frequency,
      status: form.active ? 'active' : 'paused',
    });
    setSaving(false);

    if (err) {
      setError(err.message || 'Could not create agent.');
      return;
    }
    reset();
    onCreated?.(data);
    onClose?.();
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose?.();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Create automation agent</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Agent name"
            placeholder="e.g. Product Launch Bot"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            fullWidth
            autoFocus
          />

          <TextField
            select
            label="Platform"
            value={form.platform}
            onChange={(e) => update('platform', e.target.value)}
            fullWidth
          >
            {PLATFORMS.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Persona / tone"
            placeholder="e.g. Friendly, witty, speaks to indie developers"
            value={form.persona}
            onChange={(e) => update('persona', e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />

          <Box>
            <TextField
              label="Topics"
              placeholder="Type a topic and press Enter"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={handleTopicKey}
              onBlur={addTopic}
              fullWidth
            />
            {topics.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
                {topics.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    onDelete={() => setTopics((prev) => prev.filter((x) => x !== t))}
                  />
                ))}
              </Stack>
            )}
          </Box>

          <TextField
            select
            label="Posting frequency"
            value={form.frequency}
            onChange={(e) => update('frequency', e.target.value)}
            fullWidth
          >
            {FREQUENCIES.map((f) => (
              <MenuItem key={f.value} value={f.value}>
                {f.label}
              </MenuItem>
            ))}
          </TextField>

          <FormControlLabel
            control={
              <Switch
                checked={form.active}
                onChange={(e) => update('active', e.target.checked)}
              />
            }
            label={form.active ? 'Active — queues a first post on creation' : 'Paused'}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Creating…' : 'Create agent'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
