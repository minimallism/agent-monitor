/**
 * @file KanbanBoard.tsx
 * @description Kanban-style board displaying agents grouped by their status
 * (working/waiting/completed/error). Each column paginates client-side at
 * COLUMN_PAGE_SIZE.
 */

import { useEffect, useState, useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Columns3, ChevronDown, HelpCircle } from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { AgentCard } from "../components/AgentCard";
import { EmptyState } from "../components/EmptyState";
import { CardSkeleton } from "../components/Skeleton";
import { STATUS_CONFIG, isAgentAwaitingInput } from "../lib/types";
import type { Agent, AgentStatus, EffectiveAgentStatus, Session, WSMessage } from "../lib/types";

// Persisted statuses we fetch from the API.
const AGENT_FETCH_STATUSES: AgentStatus[] = ["working", "waiting", "completed", "error"];

// Columns rendered on the board.
const AGENT_COLUMNS: EffectiveAgentStatus[] = ["working", "waiting", "completed", "error"];
const COLUMN_PAGE_SIZE = 10;

export function KanbanBoard() {
  const { t } = useTranslation("kanban");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, number>>({});

  const loadAgents = useCallback(async () => {
    // Fetch every persisted agent status. Bucketing happens below in
    // `groupedAgents`.
    //
    // Also fetch sessions so AgentCard can surface model / cwd / cost on
    // main-agent cards (they have no task and a generic name on their
    // own - the session metadata is what makes the card useful).
    const [agentResults, sessionsRes] = await Promise.all([
      Promise.all(AGENT_FETCH_STATUSES.map((status) => api.agents.list({ status }))),
      api.sessions.list({ limit: 10000 }),
    ]);
    setAgents(agentResults.flatMap((r) => r.agents));
    setSessions(sessionsRes.sessions);
  }, []);

  const load = useCallback(async () => {
    try {
      await loadAgents();
    } finally {
      setLoading(false);
    }
  }, [loadAgents]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    return eventBus.subscribe((msg: WSMessage) => {
      if (
        msg.type === "agent_created" ||
        msg.type === "agent_updated" ||
        msg.type === "session_updated" ||
        msg.type === "session_created"
      ) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(loadAgents, 300);
      }
    });
  }, [loadAgents]);

  // Lookup map for AgentCard's session prop - memoized to avoid rebuilding on every render
  const sessionsById = useMemo(() => {
    const map = new Map<string, Session>();
    for (const s of sessions) map.set(s.id, s);
    return map;
  }, [sessions]);

  // Bucket by effective status: agents with status "waiting" OR those with
  // awaiting_input_since set go into the "waiting" column. Other columns
  // exclude agents that belong in "waiting".
  const isEffectivelyWaiting = (a: Agent) => a.status === "waiting" || isAgentAwaitingInput(a);

  const groupedAgents = AGENT_COLUMNS.reduce(
    (acc, status) => {
      acc[status] =
        status === "waiting"
          ? agents.filter(isEffectivelyWaiting)
          : agents.filter((a) => a.status === status && !isEffectivelyWaiting(a));
      return acc;
    },
    {} as Record<EffectiveAgentStatus, Agent[]>
  );

  const total = agents.length;

  const wsConnected = useSyncExternalStore(eventBus.onConnection, () => eventBus.connected);

  const Header = (
    <div className="flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
          <Columns3 className="w-4.5 h-4.5 text-accent" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-100 truncate">{t("title")}</h1>
            {wsConnected ? (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                {t("common:live")}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                {t("common:offline")}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{t("agentCount", { count: agents.length })}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={load} className="btn-ghost flex-shrink-0">
          <RefreshCw className="w-4 h-4" /> {t("common:refresh")}
        </button>
      </div>
    </div>
  );

  if (!loading && total === 0) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] gap-3 animate-fade-in">
        {Header}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <EmptyState
            icon={Columns3}
            title={t("noAgents")}
            description={t("noAgentsDesc")}
            action={
              <button onClick={load} className="btn-primary">
                <RefreshCw className="w-4 h-4" /> {t("common:refresh")}
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-3 animate-fade-in">
      {Header}

      <div className="flex-1 min-h-0 flex gap-4 overflow-x-auto pb-4 px-8">
        {AGENT_COLUMNS.map((status) => {
          const config = STATUS_CONFIG[status];
          const items = groupedAgents[status];
          const limit = expanded[status] || COLUMN_PAGE_SIZE;
          return (
            <Column
              key={status}
              labelKey={config.labelKey}
              color={config.color}
              dotClass={config.dot}
              pulse={status === "working" || status === "waiting"}
              count={items?.length ?? 0}
              emptyLabel={t("noAgentsInColumn")}
              tooltip={t(`tooltip.agent.${status}`)}
              remaining={Math.max(0, (items?.length ?? 0) - limit)}
              onShowMore={() =>
                setExpanded((prev) => ({
                  ...prev,
                  [status]: limit + COLUMN_PAGE_SIZE,
                }))
              }
            >
              {loading && (items?.length ?? 0) === 0
                ? Array.from({ length: 3 }).map((_, i) => (
                    <CardSkeleton key={`sk-${status}-${i}`} />
                  ))
                : items
                    ?.slice(0, limit)
                    .map((agent) => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        session={sessionsById.get(agent.session_id)}
                      />
                    ))}
            </Column>
          );
        })}
      </div>
    </div>
  );
}

interface ColumnProps {
  labelKey: string;
  color: string;
  dotClass: string;
  pulse: boolean;
  count: number;
  emptyLabel: string;
  /** Multi-line description rendered in a tooltip when the user hovers
   *  the column's help icon. Pass an empty string to suppress the icon. */
  tooltip?: string;
  remaining: number;
  onShowMore: () => void;
  children: React.ReactNode;
}

function Column({
  labelKey,
  color,
  dotClass,
  pulse,
  count,
  emptyLabel,
  tooltip,
  remaining,
  onShowMore,
  children,
}: ColumnProps) {
  const { t } = useTranslation("kanban");
  const childrenArray = Array.isArray(children) ? children : children ? [children] : [];
  const hasChildren = childrenArray.length > 0;

  return (
    <div className="bg-surface-1 rounded-xl border border-border p-3 flex flex-col flex-shrink-0 w-72">
      <div className="flex items-center gap-2 mb-4 px-1">
        <span className={`w-2 h-2 rounded-full ${dotClass} ${pulse ? "animate-pulse-dot" : ""}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>
          {t(labelKey)}
        </span>
        {tooltip && <ColumnHelp text={tooltip} />}
        <span className="ml-auto text-[11px] text-gray-600 bg-surface-3 px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto">
        {hasChildren ? (
          <>
            {children}
            {remaining > 0 && (
              <button
                onClick={onShowMore}
                className="w-full py-2 text-[11px] text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1 transition-colors"
              >
                <ChevronDown className="w-3 h-3" />
                {t("common:showMore", { count: remaining })}
              </button>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-24 text-xs text-gray-600">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Help icon + tooltip for a Kanban column header. Hover or focus shows a
 * multi-line description explaining what the column lists and what the
 * status means in lifecycle terms. Keyboard-focusable for accessibility.
 */
function ColumnHelp({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  // Anchor positioning to the column header so the tooltip stays in-page on
  // the leftmost columns (where a centered tooltip would clip on narrow
  // viewports). We always anchor left-aligned to the trigger.
  const triggerRef = useRef<HTMLSpanElement>(null);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center cursor-help"
      tabIndex={0}
      role="img"
      aria-label={text}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      <HelpCircle className="w-3 h-3 text-gray-500 hover:text-gray-300 transition-colors" />
      {show && (
        <span
          role="tooltip"
          className="absolute left-0 top-full mt-1.5 w-64 px-3 py-2 text-[11px] leading-relaxed text-gray-200 bg-surface-3 border border-border rounded-md shadow-xl z-50 pointer-events-none whitespace-pre-line"
        >
          {text}
        </span>
      )}
    </span>
  );
}
