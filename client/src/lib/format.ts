





import i18n from "../i18n";







function parseDate(iso: string): Date {
  
  if (/[Zz]$/.test(iso) || /[+-]\d{2}:\d{2}$/.test(iso)) {
    return new Date(iso);
  }
  
  
  return new Date(iso.replace(" ", "T") + "Z");
}

type SupportedLanguage = "en" | "zh";

function getCurrentLanguage(): SupportedLanguage {
  const language = (i18n.resolvedLanguage ?? i18n.language ?? "en").toLowerCase().split("-")[0];
  if (language === "zh" || language === "en") {
    return language;
  }
  return "en";
}




export function getCurrentLocale(): string {
  const language = getCurrentLanguage();
  if (language === "zh") return "zh-CN";
  return "en-US";
}


export function formatTime(iso: string): string {
  const d = parseDate(iso);
  return d.toLocaleTimeString(getCurrentLocale(), { hour: "2-digit", minute: "2-digit" });
}



export function formatDateTime(iso: string): string {
  const d = parseDate(iso);
  return d.toLocaleString(getCurrentLocale(), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}



export function formatDateShort(iso: string): string {
  const d = parseDate(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(getCurrentLocale(), { month: "short", day: "numeric" });
}



export function formatDateTimeFull(iso: string): string {
  const d = parseDate(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(getCurrentLocale(), {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}




export function formatDuration(start: string, end: string): string {
  const ms = parseDate(end).getTime() - parseDate(start).getTime();
  return formatMs(ms);
}



export function formatMs(ms: number): string {
  if (ms < 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}



export function timeAgo(iso: string): string {
  const ms = Date.now() - parseDate(iso).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return i18n.t("common:time.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return i18n.t("common:time.mAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return i18n.t("common:time.hAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return i18n.t("common:time.dAgo", { count: days });
}



export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "\u2026";
}


export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}


export function fmtCost(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "$0.00";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}


export function fmtCostFull(n: number, decimals = 2): string {
  if (!Number.isFinite(n) || n < 0) return "$0.00";
  return `$${n.toLocaleString(getCurrentLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}




export function shortModel(model: string | null | undefined): string | null {
  if (!model) return null;
  const m = model.match(/claude-([a-z]+-\d+(?:-\d+)?)/i);
  return m?.[1] ?? model;
}

const MODEL_BRANDS: Record<string, string> = {
  claude: "Claude",
  gpt: "GPT",
  gemini: "Gemini",
};





export function formatModelName(model: string | null | undefined): string | null {
  if (!model) return null;

  
  let name = model.includes("/") ? model.split("/").pop()! : model;

  
  let ctxSuffix = "";
  const ctxMatch = name.match(/\[(\d+[mk])\]$/i);
  if (ctxMatch) {
    ctxSuffix = ` (${(ctxMatch[1] as string).toUpperCase()})`;
    name = name.slice(0, -ctxMatch[0].length);
  }

  
  name = name.replace(/-\d{8}$/, "").replace(/-latest$/i, "");

  const parts: string[] = name.split("-");
  const first = parts[0] ?? name;
  const brand = MODEL_BRANDS[first.toLowerCase()];

  
  
  if (brand === "GPT" && parts.length >= 2) {
    const versionToken = parts[1] as string;
    const rest = parts.slice(2);
    const suffix = rest
      .map((seg) => (/^\d+$/.test(seg) ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)))
      .join(" ");
    const base = suffix ? `${brand}-${versionToken} ${suffix}` : `${brand}-${versionToken}`;
    return base + ctxSuffix;
  }

  
  const result: string[] = [brand ?? first.charAt(0).toUpperCase() + first.slice(1)];

  let i = 1;
  while (i < parts.length) {
    const seg = parts[i] as string;
    if (/^\d+$/.test(seg)) {
      const ver = [seg];
      while (i + 1 < parts.length && /^\d+$/.test(parts[i + 1] as string)) {
        i++;
        ver.push(parts[i] as string);
      }
      result.push(ver.join("."));
    } else if (/^\d+\w+$/.test(seg)) {
      result.push(seg);
    } else {
      result.push(seg.charAt(0).toUpperCase() + seg.slice(1));
    }
    i++;
  }

  return result.join(" ") + ctxSuffix;
}



export function pathBasename(p: string | null | undefined): string | null {
  if (!p) return null;
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx === -1 ? trimmed : trimmed.slice(idx + 1) || trimmed;
}
