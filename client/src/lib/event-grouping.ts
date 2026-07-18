import type { DashboardEvent } from "./types";

export function statusFromEventType(type: string): "working" | "waiting" | "completed" | "error" {
  switch (type) {
    case "PreToolUse":
      return "working";
    case "PostToolUse":
      return "completed";
    case "SessionStart":
    case "SessionResumed":
    case "Stop":
      return "waiting";
    case "SubagentStop":
    case "Compaction":
      return "completed";
    case "error":
    case "APIError":
      return "error";
    default:
      return "completed";
  }
}

function humanizeMcpServer(raw: string): string {
  const tokens = raw.split(/[_-]+/).filter(Boolean);
  const dedup: string[] = [];
  for (const t of tokens) {
    if (dedup[dedup.length - 1] !== t) dedup.push(t);
  }
  const last = dedup[dedup.length - 1] ?? raw;
  return last.toLowerCase() === last ? last.charAt(0).toUpperCase() + last.slice(1) : last;
}

function humanizeMcpTool(raw: string): string {
  return raw.replace(/_+/g, " ").trim().toLowerCase();
}

function parseMcpToolName(tool: string): { server: string; tool: string } | null {
  if (!tool.startsWith("mcp__")) return null;
  const parts = tool.split("__").filter(Boolean);
  if (parts.length < 3) return null;
  const rawServer = parts[1];
  const rest = parts.slice(2);
  if (!rawServer || rest.length === 0) return null;
  return {
    server: humanizeMcpServer(rawServer),
    tool: humanizeMcpTool(rest.join("_")),
  };
}

const CONTEXT_FIELDS = [
  "description",
  "title",
  "name",
  "query",
  "q",
  "pattern",
  "url",
  "file_path",
  "path",
  "id",
  "command",
];

function buildContextHeadline(input: Record<string, unknown>): string | null {
  for (const field of CONTEXT_FIELDS) {
    const v = input[field];
    if (typeof v === "string" && v.length > 0) return v;
  }
  for (const v of Object.values(input)) {
    if (typeof v === "string" && v.length > 0 && v.length < 120) return v;
  }
  return null;
}

const SUBCOMMAND_BINARIES = new Set([
  "git",
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "docker",
  "docker-compose",
  "just",
  "make",
  "cargo",
  "python",
  "pip",
  "poetry",
  "uv",
  "node",
  "npx",
  "kubectl",
  "terraform",
  "helm",
  "aws",
  "gcloud",
  "az",
]);

function parseShellHeadline(command: string): string | null {
  const cmd = command.trim();
  if (!cmd) return null;

  
  const compose = cmd.match(/^docker\s+compose\s+([A-Za-z0-9_-]+)/);
  if (compose) return `docker compose ${compose[1]}`;

  const match = cmd.match(/^([A-Za-z0-9_.\-/\\]+)(?:\s+([A-Za-z0-9_-]+))?/);
  if (!match) return null;
  const binPath = match[1] ?? "";
  const bin = binPath.split(/[/\\]/).pop() || binPath;
  const sub = match[2];

  if (SUBCOMMAND_BINARIES.has(bin) && sub) return `${bin} ${sub}`;

  if (bin === "curl" || bin === "wget") {
    const urlMatch = cmd.match(/https?:\/\/[^\s"']+/);
    if (urlMatch) {
      try {
        return `${bin} ${new URL(urlMatch[0]).host}`;
      } catch {
        
      }
    }
    return bin;
  }

  return bin;
}

function basename(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts.length > 0 ? (parts[parts.length - 1] ?? path) : path;
}

function shortPath(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? path;
  return parts.slice(-2).join("/");
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function extractToolInput(event: DashboardEvent): Record<string, unknown> | null {
  if (!event.data) return null;
  try {
    const parsed = JSON.parse(event.data);
    const maybeInput = parsed && typeof parsed === "object" ? parsed.tool_input : null;
    if (maybeInput && typeof maybeInput === "object" && !Array.isArray(maybeInput)) {
      return maybeInput as Record<string, unknown>;
    }
  } catch {
    
  }
  return null;
}

export function buildEventTitle(event: DashboardEvent): string {
  if (!event.tool_name) return event.summary || event.event_type;

  const input = extractToolInput(event);
  const s = (v: unknown): string => (typeof v === "string" ? v : "");
  const trunc = (text: string, max = 80): string =>
    text.length > max ? text.slice(0, max) + "..." : text;

  
  const mcp = parseMcpToolName(event.tool_name);
  if (mcp) {
    const ctx = input ? buildContextHeadline(input) : null;
    return ctx ? `${mcp.server} · ${mcp.tool} · ${trunc(ctx)}` : `${mcp.server} · ${mcp.tool}`;
  }

  if (!input) return `${event.tool_name}${event.summary ? `: ${event.summary}` : ""}`;

  
  switch (event.tool_name) {
    case "Bash":
    case "PowerShell": {
      const desc = s(input.description);
      const cmd = s(input.command);
      const headline = parseShellHeadline(cmd);
      if (headline && desc) return `${event.tool_name} · ${headline} - ${trunc(desc, 60)}`;
      if (headline) return `${event.tool_name} · ${headline}`;
      if (desc) return `${event.tool_name}: ${desc}`;
      if (cmd) return `${event.tool_name}: ${trunc(cmd)}`;
      break;
    }
    case "Read": {
      const path = s(input.file_path);
      if (path) return `Read · ${shortPath(path)}`;
      break;
    }
    case "Write": {
      const path = s(input.file_path);
      if (path) return `Write · ${shortPath(path)}`;
      break;
    }
    case "Edit":
    case "NotebookEdit": {
      const path = s(input.file_path);
      if (path) {
        const suffix = input.replace_all === true ? " (all)" : "";
        return `${event.tool_name} · ${shortPath(path)}${suffix}`;
      }
      break;
    }
    case "Grep": {
      const pattern = s(input.pattern);
      const path = s(input.path);
      if (pattern) {
        return path
          ? `Grep · "${trunc(pattern, 40)}" in ${basename(path)}`
          : `Grep · "${trunc(pattern, 40)}"`;
      }
      break;
    }
    case "Glob": {
      const pattern = s(input.pattern);
      if (pattern) return `Glob · "${pattern}"`;
      break;
    }
    case "WebFetch": {
      const url = s(input.url);
      if (url) return `WebFetch · ${hostFromUrl(url)}`;
      break;
    }
    case "Agent":
    case "Task": {
      const desc = s(input.description);
      const subtype = s(input.subagent_type);
      if (desc && subtype) return `${event.tool_name} · ${subtype} - ${trunc(desc, 60)}`;
      if (desc) return `${event.tool_name} · ${trunc(desc, 60)}`;
      if (subtype) return `${event.tool_name} · ${subtype}`;
      break;
    }
    case "TaskCreate":
    case "TaskUpdate":
    case "TaskGet":
    case "TaskStop":
    case "TaskOutput":
    case "TaskList": {
      const desc = s(input.description);
      const id = s(input.id);
      if (desc) return `${event.tool_name} · ${trunc(desc, 60)}`;
      if (id) return `${event.tool_name} · ${id}`;
      break;
    }
    case "ScheduleWakeup": {
      const delay = input.delaySeconds;
      const reason = s(input.reason);
      if (typeof delay === "number") {
        return `ScheduleWakeup · ${delay}s${reason ? ` - ${trunc(reason, 50)}` : ""}`;
      }
      break;
    }
    case "AskUserQuestion": {
      const qs = input.questions;
      if (Array.isArray(qs) && qs.length > 0) {
        const first = qs[0];
        if (first && typeof first === "object") {
          const q = s((first as Record<string, unknown>).question);
          if (q) return `AskUserQuestion · "${trunc(q, 60)}"`;
        }
      }
      break;
    }
    case "Monitor": {
      const cmd = s(input.command);
      if (cmd) return `Monitor · ${trunc(cmd)}`;
      break;
    }
    case "ToolSearch": {
      const q = s(input.query);
      if (q) return `ToolSearch · ${trunc(q, 60)}`;
      break;
    }
    default: {
      
      const ctx = buildContextHeadline(input);
      if (ctx) return `${event.tool_name} · ${trunc(ctx)}`;
    }
  }

  return `${event.tool_name}${event.summary ? ` · ${event.summary}` : ""}`;
}

export function shortAgentLabel(agentId: string | null): string | null {
  if (!agentId) return null;
  if (agentId.endsWith("-main")) return null;
  
  return agentId.length > 8 ? agentId.slice(-8) : agentId;
}

export type AgentInfo = {
  type: "main" | "subagent";
  subagent_type: string | null;
  name: string;
  parent_agent_id?: string | null;
};

function singleAgentSegment(info: AgentInfo): string | null {
  if (info.type === "main") return null;
  if (info.subagent_type && info.subagent_type.length > 0) return info.subagent_type;
  if (info.name && info.name.length > 0) return info.name;
  return null;
}

export function agentPillLabel(agentId: string | null, info: AgentInfo | undefined): string | null {
  if (!agentId) return null;
  if (info) {
    const seg = singleAgentSegment(info);
    if (seg !== null) return seg;
    if (info.type === "main") return null;
  }
  return shortAgentLabel(agentId);
}

export function agentOriginLabel(
  agentId: string | null,
  infoOrMap: AgentInfo | Map<string, AgentInfo> | undefined
): string | null {
  if (!agentId) return null;
  const map = infoOrMap instanceof Map ? infoOrMap : null;
  const info = map ? map.get(agentId) : (infoOrMap as AgentInfo | undefined);

  
  
  if (!map) {
    if (info) {
      if (info.type === "main") return "main";
      const seg = singleAgentSegment(info);
      if (seg) return seg;
    }
    if (agentId.endsWith("-main")) return "main";
    return shortAgentLabel(agentId);
  }

  
  const segments: string[] = [];
  const seen = new Set<string>();
  let cursor: string | null = agentId;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const node = map.get(cursor);
    if (!node) break;
    if (node.type === "main") {
      segments.unshift("main");
      break;
    }
    const seg = singleAgentSegment(node);
    if (seg) segments.unshift(seg);
    cursor = node.parent_agent_id ?? null;
  }

  if (segments.length === 0) {
    if (agentId.endsWith("-main")) return "main";
    return shortAgentLabel(agentId);
  }
  return segments.join(" › ");
}

export function buildOriginLabel(
  projectName: string | null | undefined,
  sessionName: string | null | undefined,
  agentLabel: string | null
): string | null {
  const parts: string[] = [];
  if (projectName) parts.push(projectName);
  if (sessionName && sessionName !== projectName) parts.push(sessionName);
  if (agentLabel) parts.push(agentLabel);
  return parts.length > 0 ? parts.join(" › ") : null;
}

export function projectFromCwd(cwd: string | null | undefined): string | null {
  if (typeof cwd !== "string" || cwd.length === 0) return null;
  return basename(cwd);
}

export function projectFromEvent(event: DashboardEvent): string | null {
  if (!event.data) return null;
  try {
    const parsed = JSON.parse(event.data);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const cwd = (parsed as Record<string, unknown>).cwd;
      if (typeof cwd === "string" && cwd.length > 0) return projectFromCwd(cwd);
    }
  } catch {
    
  }
  return null;
}
