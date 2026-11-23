-- Applied 2026-11-23 after trimming the dashboard (PR #6). JSON backup kept outside the repo.
drop view if exists public.agent_daily_throughput;
drop view if exists public.brand_knowledge_graph;
drop table if exists public.video_agent_state, public.generation_jobs, public.weekly_template,
  public.content_posts, public.content_drafts, public.content_plans, public.voice_samples,
  public.tutorial_videos, public.news_briefs, public.bot_commands, public.replies,
  public.brand_profile, public.discord_notified_articles, public.integration_settings,
  public.brand_knowledge_edges, public.brand_knowledge_nodes, public.mcp_tokens,
  public.email_scrape_automation, public.agent_metrics, public.agent_events;
drop function if exists public.get_integration_secret(text);
drop function if exists public.set_integration_secret(text, text);
drop function if exists public.set_brand_knowledge_updated_at();
delete from vault.secrets where name = 'discord_blog_webhook';
