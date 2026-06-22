import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  addEdge,
  deleteNode,
  getGraph,
  getNode,
  listTypes,
  searchNodes,
  upsertNode,
} from "@/features/knowledge-graph/graph-service";
import { isPatToken, verifyToken as verifyPat } from "@/features/mcp-tokens/service";

// Service-role + JWT validation require the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const DEFAULT_BRAND = process.env.BRAND_KNOWLEDGE_DEFAULT_BRAND ?? "opencraft";

/** Read client bound to the caller's JWT — RLS sees them as the logged-in user. */
function readClient(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Pick a read client for the request. JWT auth → an RLS client acting as that
 * user. PAT auth → the service-role client (the PAT already proved the caller
 * is an internal user, and there's no user JWT to bind).
 */
function readFrom(extra: { authInfo?: AuthInfo }): SupabaseClient {
  const jwt = extra.authInfo?.extra?.supabaseJwt as string | undefined;
  return jwt ? readClient(jwt) : createAdminClient();
}

/** Throw unless the request was authenticated (write tools require this). */
function ensureAuth(extra: { authInfo?: AuthInfo }) {
  if (!extra.authInfo) throw new Error("Unauthenticated.");
}

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});
const fail = (message: string) => ({
  isError: true,
  content: [{ type: "text" as const, text: message }],
});

const brandArg = z
  .string()
  .optional()
  .describe(`Brand slug. Defaults to "${DEFAULT_BRAND}".`);

const baseHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_graph",
      {
        title: "Get full brand knowledge graph",
        description:
          "Return the entire knowledge graph (all nodes and edges) for a brand, plus counts by node type. Use for an overview or to feed a visualization.",
        inputSchema: { brand_slug: brandArg },
      },
      async ({ brand_slug }, extra) => {
        try {
          return ok(await getGraph(readFrom(extra), brand_slug ?? DEFAULT_BRAND));
        } catch (e) {
          return fail((e as Error).message);
        }
      },
    );

    server.registerTool(
      "search_nodes",
      {
        title: "Search knowledge nodes",
        description:
          "Find nodes whose label or description matches a query (case-insensitive). Optionally filter by node type.",
        inputSchema: {
          query: z.string().describe("Text to match against node label and description."),
          brand_slug: brandArg,
          type: z.string().optional().describe("Optional node type filter, e.g. 'topic'."),
          limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)."),
        },
      },
      async ({ query, brand_slug, type, limit }, extra) => {
        try {
          return ok(
            await searchNodes(readFrom(extra), brand_slug ?? DEFAULT_BRAND, query, type, limit ?? 20),
          );
        } catch (e) {
          return fail((e as Error).message);
        }
      },
    );

    server.registerTool(
      "get_node",
      {
        title: "Get a node with its relationships",
        description:
          "Return one node (by id or exact label) with its outgoing and incoming edges and neighbour labels — a 360° view of one entity.",
        inputSchema: {
          ref: z.string().describe("Node id (uuid) or exact label."),
          brand_slug: brandArg,
        },
      },
      async ({ ref, brand_slug }, extra) => {
        try {
          const brand = brand_slug ?? DEFAULT_BRAND;
          const res = await getNode(readFrom(extra), brand, ref);
          return res ? ok(res) : fail(`No node found for ref "${ref}" in brand "${brand}".`);
        } catch (e) {
          return fail((e as Error).message);
        }
      },
    );

    server.registerTool(
      "list_types",
      {
        title: "List node types with counts",
        description: "Return the distinct node types in a brand graph and how many nodes each has.",
        inputSchema: { brand_slug: brandArg },
      },
      async ({ brand_slug }, extra) => {
        try {
          return ok(await listTypes(readFrom(extra), brand_slug ?? DEFAULT_BRAND));
        } catch (e) {
          return fail((e as Error).message);
        }
      },
    );

    server.registerTool(
      "upsert_node",
      {
        title: "Create or update a knowledge node",
        description:
          "Insert a new node, or update an existing one when `id` is supplied. Curate the brand's knowledge (topic, value, audience, competitor, etc.).",
        inputSchema: {
          id: z.string().uuid().optional().describe("Existing node id to update. Omit to create."),
          brand_slug: brandArg,
          type: z.string().describe("Node type, e.g. brand|value|topic|subtopic|audience|persona|channel|tone|strategy|anti_topic|competitor."),
          label: z.string().describe("Display label (unique per brand recommended)."),
          description: z.string().optional(),
          props: z.record(z.any()).optional().describe("Arbitrary JSON metadata."),
          color: z.string().optional().describe("Hex colour for the viz, e.g. '#6366f1'."),
          icon: z.string().optional().describe("Emoji or short icon."),
        },
      },
      async ({ brand_slug, ...input }, extra) => {
        try {
          ensureAuth(extra);
          return ok(await upsertNode(createAdminClient(), brand_slug ?? DEFAULT_BRAND, input));
        } catch (e) {
          return fail((e as Error).message);
        }
      },
    );

    server.registerTool(
      "add_edge",
      {
        title: "Add a relationship between two nodes",
        description:
          "Create an edge from source to target. Each endpoint may be a node id (uuid) or an exact node label (resolved within the brand).",
        inputSchema: {
          brand_slug: brandArg,
          source: z.string().describe("Source node id or exact label."),
          target: z.string().describe("Target node id or exact label."),
          relation: z.string().describe("Relationship verb, e.g. offers|serves|values|includes|interested_in|avoids|publishes_on|has_tone|uses_strategy|competes_with."),
          weight: z.number().optional().describe("Edge weight / strength (default 1)."),
          props: z.record(z.any()).optional(),
        },
      },
      async ({ brand_slug, source, target, relation, weight, props }, extra) => {
        try {
          ensureAuth(extra);
          return ok(
            await addEdge(createAdminClient(), brand_slug ?? DEFAULT_BRAND, source, target, relation, weight ?? 1, props ?? {}),
          );
        } catch (e) {
          return fail((e as Error).message);
        }
      },
    );

    server.registerTool(
      "delete_node",
      {
        title: "Delete a node (and its edges)",
        description:
          "Permanently delete a node by id. Connected edges are removed via cascade. Use carefully.",
        inputSchema: { id: z.string().uuid().describe("Node id to delete.") },
      },
      async ({ id }, extra) => {
        try {
          ensureAuth(extra);
          return ok(await deleteNode(createAdminClient(), id));
        } catch (e) {
          return fail((e as Error).message);
        }
      },
    );
  },
  {},
  { basePath: "/api" },
);

/**
 * Gate every request on a credential. Internal users present EITHER a durable
 * Personal Access Token (`ocb_live_…`, recommended) OR a short-lived Supabase
 * access token, as `Authorization: Bearer <token>`. PATs are validated against
 * `mcp_tokens`; JWTs against Supabase Auth (and bound to RLS reads).
 */
const verifyToken = async (
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;

  if (isPatToken(bearerToken)) {
    const res = await verifyPat(createAdminClient(), bearerToken);
    if (!res) return undefined;
    return { token: bearerToken, clientId: res.userId, scopes: [], extra: { userId: res.userId } };
  }

  const { data, error } = await createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.getUser(bearerToken);
  if (error || !data.user) return undefined;
  return {
    token: bearerToken,
    clientId: data.user.id,
    scopes: [],
    // supabaseJwt lets read tools act as this user under RLS.
    extra: { userId: data.user.id, supabaseJwt: bearerToken },
  };
};

const handler = withMcpAuth(baseHandler, verifyToken, { required: true });

export { handler as GET, handler as POST, handler as DELETE };
