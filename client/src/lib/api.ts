import type {
  Agent,
  Analytics,
  CostResult,
  DashboardEvent,
  Session,
  SessionStats,
  Stats,
  TranscriptListResult,
  TranscriptResult,
  WorkflowData,
  WorkflowRun,
  WorkflowRunsResponse,
  WorkflowRunDetail,
} from "../lib/types";

const BASE = "/api";

export function dashboardToken(): string | null {
  try {
    const injected = (globalThis as { __DASHBOARD_TOKEN__?: unknown }).__DASHBOARD_TOKEN__;
    if (typeof injected === "string" && injected) return injected;
    const stored = localStorage.getItem("dashboard_token");
    return stored && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = dashboardToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { "x-dashboard-token": token } : {}),
    ...((options?.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  
  stats: {
    

    get: () => request<Stats>(`/stats?tz_offset=${new Date().getTimezoneOffset()}`),
  },

  
  sessions: {
    
    facets: () => request<{ cwds: string[] }>("/sessions/facets"),
    
    list: (params?: {
      status?: string;
      q?: string;
      cwd?: string;
      sort_by?: string;
      sort_desc?: boolean;
      limit?: number;
      offset?: number;
    }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.q) qs.set("q", params.q);
      if (params?.cwd) qs.set("cwd", params.cwd);
      if (params?.sort_by) qs.set("sort_by", params.sort_by);
      if (params?.sort_desc !== undefined) qs.set("sort_desc", String(params.sort_desc));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      const queryString = qs.toString();
      return request<{ sessions: Session[]; total: number; limit: number; offset: number }>(
        `/sessions${queryString ? `?${queryString}` : ""}`
      );
    },
    

    get: (id: string) =>
      request<{
        session: Session;
        agents: Agent[];
        events: DashboardEvent[];
        workflows: WorkflowRun[];
      }>(`/sessions/${encodeURIComponent(id)}`),
    
    stats: (id: string) => request<SessionStats>(`/sessions/${encodeURIComponent(id)}/stats`),
    

    transcripts: (id: string) =>
      request<TranscriptListResult>(`/sessions/${encodeURIComponent(id)}/transcripts`),
    

    transcript: (
      id: string,
      params?: {
        agent_id?: string;
        run_id?: string;
        limit?: number;
        offset?: number;
        after?: number;
        before?: number;
      }
    ) => {
      const qs = new URLSearchParams();
      if (params?.agent_id) qs.set("agent_id", params.agent_id);
      if (params?.run_id) qs.set("run_id", params.run_id);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      if (params?.after != null) qs.set("after", String(params.after));
      if (params?.before != null) qs.set("before", String(params.before));
      const q = qs.toString();
      return request<TranscriptResult>(
        `/sessions/${encodeURIComponent(id)}/transcript${q ? `?${q}` : ""}`
      );
    },
  },

  agents: {
    
    list: (params?: { status?: string; session_id?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.session_id) qs.set("session_id", params.session_id);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      const q = qs.toString();
      return request<{ agents: Agent[] }>(`/agents${q ? `?${q}` : ""}`);
    },
  },

  events: {
    

    list: (params?: {
      event_type?: string[];
      tool_name?: string[];
      agent_id?: string[];
      session_id?: string | string[];
      q?: string;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    }) => {
      const qs = new URLSearchParams();
      const csv = (v?: string[]) => (v && v.length > 0 ? v.join(",") : undefined);
      const et = csv(params?.event_type);
      const tn = csv(params?.tool_name);
      const ag = csv(params?.agent_id);
      const sid = Array.isArray(params?.session_id) ? csv(params?.session_id) : params?.session_id;
      if (et) qs.set("event_type", et);
      if (tn) qs.set("tool_name", tn);
      if (ag) qs.set("agent_id", ag);
      if (sid) qs.set("session_id", sid);
      if (params?.q) qs.set("q", params.q);
      if (params?.from) qs.set("from", params.from);
      if (params?.to) qs.set("to", params.to);
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      const q = qs.toString();
      return request<{
        events: DashboardEvent[];
        limit: number;
        offset: number;
        total: number;
      }>(`/events${q ? `?${q}` : ""}`);
    },
    
    facets: () => request<{ event_types: string[]; tool_names: string[] }>("/events/facets"),
  },

  
  analytics: {
    

    get: () => request<Analytics>(`/analytics?tz_offset=${new Date().getTimezoneOffset()}`),
  },

  

  settings: {
    

    info: () =>
      request<{
        db: {
          path: string;
          size: number;
          counts: Record<string, number>;
          pragmas: {
            journal_mode: string;
            synchronous: number;
            auto_vacuum: number;
            encoding: string;
            foreign_keys: number;
            busy_timeout: number;
          };
          load_stats: { m5: number; m15: number; h1: number };
        };
        hooks: { installed: boolean; path: string; hooks: Record<string, boolean> };
        server: {
          uptime: number;
          node_version: string;
          platform: string;
          ws_connections: number;
          memory: { rss: number; heapTotal: number; heapUsed: number; external: number };
          cpu_load: number[];
          arch: string;
          total_mem: number;
          free_mem: number;
          cpus: number;
        };
        transcript_cache: {
          size: number;
          maxSize: number;
          hits: number;
          misses: number;
          keys: string[];
        };
      }>("/settings/info"),
    

    clearData: () =>
      request<{ ok: boolean; cleared: Record<string, number> }>("/settings/clear-data", {
        method: "POST",
      }),
    

    reinstallHooks: () =>
      request<{ ok: boolean; hooks: { installed: boolean; hooks: Record<string, boolean> } }>(
        "/settings/reinstall-hooks",
        { method: "POST" }
      ),

    

    cleanup: (params: { abandon_hours?: number; purge_days?: number }) =>
      request<{
        ok: boolean;
        abandoned: number;
        purged_sessions: number;
        purged_events: number;
        purged_agents: number;
      }>("/settings/cleanup", { method: "POST", body: JSON.stringify(params) }),
  },

  

  workflows: {
    

    get: (status?: string) =>
      request<WorkflowData>(`/workflows${status && status !== "all" ? `?status=${status}` : ""}`),
    
    
    runs: (params?: { status?: string; session_id?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status && params.status !== "all") qs.set("status", params.status);
      if (params?.session_id) qs.set("session_id", params.session_id);
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      const q = qs.toString();
      return request<WorkflowRunsResponse>(`/workflows/runs${q ? `?${q}` : ""}`);
    },
    
    run: (runId: string) =>
      request<WorkflowRunDetail>(`/workflows/runs/${encodeURIComponent(runId)}`),
  },

  

  cost: {
    total: () =>
      request<CostResult>(`/pricing/cost?tz_offset=${new Date().getTimezoneOffset()}`),
    

    session: (sessionId: string) =>
      request<CostResult>(
        `/pricing/cost/${encodeURIComponent(sessionId)}?tz_offset=${new Date().getTimezoneOffset()}`
      ),
  },

};
