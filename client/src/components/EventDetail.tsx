import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DashboardEvent } from "../lib/types";
import type { AgentInfo } from "../lib/event-grouping";
import { buildEventSummary } from "../lib/event-summary";
import { formatModelName, formatDateTimeFull } from "../lib/format";
import { CopyButton } from "./event-views/primitives";
import { ToolInputView, ToolResponseView } from "./event-views/tool-views";

type EventDetailProps = {
  event: DashboardEvent;
  

  agentInfoById?: Map<string, AgentInfo>;
  

  sessionNameById?: Map<string, string>;
};

function agentDisplayLabel(info: AgentInfo): string | null {
  if (info.type === "main") {
    return info.name && info.name.trim().length > 0 ? info.name : null;
  }
  const type = info.subagent_type?.trim();
  const name = info.name?.trim();
  if (type && name && name !== type) return `${type} · ${name}`;
  if (type) return type;
  if (name) return name;
  return null;
}

const DUPLICATE_KEYS = new Set(["id", "event_id", "session_id", "agent_id"]);

const PAYLOAD_LABEL_KEYS: Record<string, string> = {
  tool_name: "eventDetail.toolName",
  tool_use_id: "eventDetail.toolUseId",
  tool_input: "eventDetail.toolInput",
  tool_response: "eventDetail.toolResponse",
  is_error: "eventDetail.isError",
  cwd: "eventDetail.cwd",
  permission_mode: "eventDetail.permissionMode",
  transcript_path: "eventDetail.transcriptPath",
  agent_transcript_path: "eventDetail.agentTranscriptPath",
  hook_event_name: "eventDetail.hookEventName",
  stop_reason: "eventDetail.stopReason",
  stop_hook_active: "eventDetail.stopHookActive",
  subagent_type: "eventDetail.subagentType",
  agent_type: "eventDetail.agentType",
  notification_type: "eventDetail.notificationType",
  message: "eventDetail.message",
  prompt: "eventDetail.prompt",
  model: "eventDetail.model",
  reason: "eventDetail.reason",
  source: "eventDetail.source",
  imported: "eventDetail.imported",
  type: "eventDetail.type",
  timestamp: "eventDetail.timestamp",
  uuid: "eventDetail.uuid",
  duration_ms: "eventDetail.durationMs",
  durationMs: "eventDetail.durationMs",
  compaction_number: "eventDetail.compactionNumber",
  total_compactions: "eventDetail.totalCompactions",
  last_assistant_message: "eventDetail.lastAssistantMessage",
};

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type Row = { key: string; label: string; value: unknown };

export function EventDetail({ event, agentInfoById, sessionNameById }: EventDetailProps) {
  const { t } = useTranslation("common");

  const parsed = useMemo<Record<string, unknown> | null>(() => {
    if (!event.data) return null;
    try {
      const v = JSON.parse(event.data);
      return v && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }, [event.data]);

  const summary = useMemo(() => buildEventSummary(event), [event]);

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [{ key: "event_id", label: t("eventDetail.eventId"), value: event.id }];
    
    
    if (event.created_at) {
      result.push({
        key: "recorded_at",
        label: t("eventDetail.recordedAt", "Recorded at"),
        value: formatDateTimeFull(event.created_at),
      });
    }
    
    
    
    const sessionName = sessionNameById?.get(event.session_id);
    if (sessionName && sessionName.trim().length > 0) {
      result.push({ key: "session_name", label: t("eventDetail.session"), value: sessionName });
    }
    result.push({
      key: "session_id",
      label: t("eventDetail.sessionId"),
      value: event.session_id,
    });
    if (event.agent_id) {
      
      
      
      const info = agentInfoById?.get(event.agent_id);
      const displayName = info ? agentDisplayLabel(info) : null;
      if (displayName) {
        result.push({ key: "agent_name", label: t("eventDetail.agent"), value: displayName });
      }
      result.push({ key: "agent_id", label: t("eventDetail.agentId"), value: event.agent_id });
    }

    const payloadEntries: Array<[string, unknown]> = parsed
      ? Object.entries(parsed).filter(([k]) => !DUPLICATE_KEYS.has(k))
      : [];
    for (const [k, v] of payloadEntries) {
      
      
      
      const i18nKey = PAYLOAD_LABEL_KEYS[k];
      const label = i18nKey ? t(i18nKey) : humanizeKey(k);
      result.push({
        key: k,
        label,
        value: k === "model" && typeof v === "string" ? (formatModelName(v) ?? v) : v,
      });
    }

    
    
    if (!parsed && event.data) {
      result.push({ key: "data", label: t("eventDetail.rawPayload"), value: event.data });
    }

    return result;
  }, [
    event.id,
    event.session_id,
    event.agent_id,
    event.data,
    parsed,
    agentInfoById,
    sessionNameById,
    t,
  ]);

  const hasToolInput = parsed != null && "tool_input" in parsed;
  const hasToolResponse = parsed != null && "tool_response" in parsed;

  return (
    <div className="bg-surface-2/60 border-t border-border px-5 py-4 animate-slide-up space-y-3">
      {summary && (
        <SummaryBlock
          summary={summary}
          hasToolInput={hasToolInput}
          hasToolResponse={hasToolResponse}
        />
      )}
      <div className="space-y-2">
        {rows.map((row) => (
          <FieldRow
            key={row.key}
            rowKey={row.key}
            label={row.label}
            value={row.value}
            toolName={event.tool_name}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryBlock({
  summary,
  hasToolInput,
  hasToolResponse,
}: {
  summary: { icon: string; headline: string; bullets: string[] };
  hasToolInput: boolean;
  hasToolResponse: boolean;
}) {
  const { t } = useTranslation("common");
  const refs: string[] = [];
  if (hasToolInput) refs.push("tool_input");
  if (hasToolResponse) refs.push("tool_response");
  const hint =
    refs.length > 0 ? t("eventDetail.seeDetailsBelow", { fields: refs.join(" · ") }) : null;
  return (
    <div className="border border-border rounded overflow-hidden bg-surface-3/30">
      <div className="px-3 py-1 border-b border-border bg-black/20">
        <span className="text-gray-500 text-[10px] uppercase tracking-wide font-semibold">
          {t("eventDetail.summary")}
        </span>
      </div>
      <div className="p-3 space-y-1.5">
        <div className="flex items-start gap-2">
          <span className="text-base leading-none" aria-hidden="true">
            {summary.icon}
          </span>
          <span className="text-[12px] text-gray-100 font-medium break-words">
            {summary.headline}
          </span>
        </div>
        {summary.bullets.length > 0 && (
          <ul className="list-disc pl-6 space-y-0.5 text-[11px] text-gray-400">
            {summary.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}
        {hint && (
          <div className="text-[11px] text-gray-500 italic pt-1 border-t border-border/40">
            ↓ {hint}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldRow({
  rowKey,
  label,
  value,
  toolName,
}: {
  

  rowKey: string;
  label: string;
  value: unknown;
  toolName: string | null;
}) {
  
  
  
  if (rowKey === "tool_input") {
    const view = ToolInputView({ toolName, input: value });
    if (view) {
      return (
        <div className="grid grid-cols-[160px_1fr] gap-x-4 items-start text-[11px]">
          <div className="text-gray-500 font-mono pt-2">{label}</div>
          <div>{view}</div>
        </div>
      );
    }
  }
  if (rowKey === "tool_response") {
    const view = ToolResponseView({ toolName, response: value });
    if (view) {
      return (
        <div className="grid grid-cols-[160px_1fr] gap-x-4 items-start text-[11px]">
          <div className="text-gray-500 font-mono pt-2">{label}</div>
          <div>{view}</div>
        </div>
      );
    }
  }

  if (isInlineScalar(value)) {
    return (
      <div className="grid grid-cols-[160px_1fr] gap-x-4 items-start text-[11px]">
        <div className="text-gray-500 font-mono pt-0.5">{label}</div>
        <div className="text-gray-300 font-mono break-all">
          <ScalarValue value={value} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[160px_1fr] gap-x-4 items-start text-[11px]">
      <div className="text-gray-500 font-mono pt-2">{label}</div>
      <CodeView value={value} />
    </div>
  );
}

function isInlineScalar(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "boolean" || typeof value === "number") return true;
  if (typeof value === "string") return !value.includes("\n") && value.length <= 120;
  return false;
}

function ScalarValue({ value }: { value: unknown }) {
  if (value == null) return <span className="text-gray-500 italic">null</span>;
  if (typeof value === "boolean") {
    const color = value
      ? "text-green-400 border-green-500/30 bg-green-500/10"
      : "text-gray-400 border-gray-500/30 bg-gray-500/10";
    return (
      <span className={`inline-block px-2 py-0.5 rounded border ${color}`}>{String(value)}</span>
    );
  }
  return <>{String(value)}</>;
}

function CodeView({ value }: { value: unknown }) {
  const text = typeof value === "string" ? value : safeStringify(value);

  return (
    <div className="relative bg-black/70 border border-border rounded font-mono text-[11px] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-black/40">
        <span className="text-gray-500 text-[10px] uppercase tracking-wide">
          {typeof value === "string" ? "text" : Array.isArray(value) ? "array" : "json"}
        </span>
        <CopyButton text={text} />
      </div>
      <pre className="px-3 py-2 text-gray-200 whitespace-pre-wrap break-words max-h-96 overflow-auto">
        {text}
      </pre>
    </div>
  );
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
