// Agent CRUD + the small "automation" step that wires agents to the posts
// the dashboard monitors. All writes go through Supabase.

import { supabase } from '@/lib/supabaseClient';

const FREQUENCY_OFFSET_MS = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

function nextScheduledFor(frequency) {
  const offset = FREQUENCY_OFFSET_MS[frequency] ?? FREQUENCY_OFFSET_MS.daily;
  return new Date(Date.now() + offset).toISOString();
}

// Draft the agent's first post from its persona + topics. This stands in for a
// content-generation backend so the monitoring dashboard reflects the new agent
// immediately. Swap this out for a real LLM/generation call when available.
function draftFirstPost(agent) {
  const topic = agent.topics?.[0] || 'your brand';
  const tone = agent.persona ? `${agent.persona} ` : '';
  return `${tone}Kicking things off with a post about ${topic}. ✨ — auto-drafted by "${agent.name}"`;
}

export async function listAgents() {
  return supabase.from('agents').select('*').order('created_at', { ascending: false });
}

// Creates the agent and, if active, queues its first scheduled post.
export async function createAgent(input) {
  const payload = {
    name: input.name.trim(),
    platform: input.platform,
    persona: input.persona?.trim() || null,
    topics: input.topics || [],
    frequency: input.frequency,
    status: input.status,
  };

  const { data: agent, error } = await supabase
    .from('agents')
    .insert(payload)
    .select()
    .single();

  if (error) return { data: null, error };

  if (agent.status === 'active') {
    // Queue the agent's first automated post. Non-fatal if it fails.
    await supabase.from('posts').insert({
      agent_id: agent.id,
      platform: agent.platform,
      content: draftFirstPost(agent),
      status: 'scheduled',
      scheduled_for: nextScheduledFor(agent.frequency),
    });
  }

  return { data: agent, error: null };
}

export async function setAgentStatus(id, status) {
  return supabase.from('agents').update({ status }).eq('id', id).select().single();
}

export async function deleteAgent(id) {
  return supabase.from('agents').delete().eq('id', id);
}
