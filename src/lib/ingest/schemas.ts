// Zod schemas for the ingestion API (/api/ingest/*).
// Agents POST these payloads; a 400 means the shape is wrong.
import { z } from "zod";

const slug = z.string().min(1).max(64);
const isoDate = z.string().datetime({ offset: true });

export const heartbeatSchema = z.object({
  slug,
});

export const runSchema = z
  .object({
    slug,
    run_id: z.number().int().positive().optional(),
    external_id: z.string().max(128).optional(),
    status: z.enum(["running", "succeeded", "failed"]),
    items_processed: z.number().int().min(0).optional(),
    duration_ms: z.number().int().min(0).optional(),
    error_msg: z.string().max(4000).optional(),
    started_at: isoDate.optional(),
    finished_at: isoDate.optional(),
  })
  // A finishing call must identify the run it closes.
  .refine((v) => v.status === "running" || v.run_id != null || v.external_id != null, {
    message: "Closing a run requires run_id or external_id",
    path: ["run_id"],
  });

export const metricSchema = z.object({
  slug,
  run_id: z.number().int().positive().optional(),
  metric_key: z.string().min(1).max(128),
  value: z.number(),
  labels: z.record(z.string(), z.unknown()).optional(),
  recorded_at: isoDate.optional(),
});

export const eventSchema = z.object({
  slug,
  run_id: z.number().int().positive().optional(),
  level: z.enum(["info", "warning", "error"]).default("info"),
  message: z.string().min(1).max(4000),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const documentSchema = z.object({
  slug,
  run_id: z.number().int().positive().optional(),
  external_id: z.string().max(128).optional(),
  title: z.string().min(1).max(512),
  doc_type: z.string().max(64).optional(),
  tool: z.string().max(128).optional(),
  status: z.enum(["generated", "failed", "pending"]).default("generated"),
  word_count: z.number().int().min(0).optional(),
  size_bytes: z.number().int().min(0).optional(),
  duration_ms: z.number().int().min(0).optional(),
  s3_bucket: z.string().max(256).optional(),
  s3_key: z.string().max(1024).optional(),
  s3_region: z.string().max(64).optional(),
  storage_bucket: z.string().max(256).optional(),
  storage_path: z.string().max(1024).optional(),
  file_url: z.string().url().max(2048).optional(),
  error_msg: z.string().max(4000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  generated_at: isoDate.optional(),
});

export type HeartbeatPayload = z.infer<typeof heartbeatSchema>;
export type RunPayload = z.infer<typeof runSchema>;
export type MetricPayload = z.infer<typeof metricSchema>;
export type EventPayload = z.infer<typeof eventSchema>;
export type DocumentPayload = z.infer<typeof documentSchema>;
