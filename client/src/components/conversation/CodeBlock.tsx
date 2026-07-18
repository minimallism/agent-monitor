







import { useMemo, useState } from "react";
import { Check, Copy, FileCode } from "lucide-react";
import { canonicalLang, highlight, tokenClass, type Token } from "../../lib/highlight";

interface CodeBlockProps {
  code: string;
  lang?: string;
  
  filename?: string;
  
  compact?: boolean;
  
  label?: string;
  
  tone?: "default" | "danger" | "success";
  
  maxHeight?: string | null;
  
  showLineNumbers?: boolean;
}

const LANG_DISPLAY: Record<string, string> = {
  js: "JavaScript",
  ts: "TypeScript",
  python: "Python",
  json: "JSON",
  bash: "Shell",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  yaml: "YAML",
  diff: "Diff",
  plain: "Text",
};

function langDisplay(lang: string): string {
  const canon = canonicalLang(lang);
  return LANG_DISPLAY[canon] ?? (lang || "Text");
}





function splitTokensByLine(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];
  for (const t of tokens) {
    const parts = t.text.split("\n");
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) lines.push([]);
      const piece = parts[i]!;
      if (piece.length > 0) {
        lines[lines.length - 1]!.push({ type: t.type, text: piece });
      }
    }
  }
  return lines;
}

export function CodeBlock({
  code,
  lang = "",
  filename,
  compact = false,
  label,
  tone = "default",
  maxHeight = "24rem",
  showLineNumbers,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const tokens = useMemo(() => highlight(code, lang), [code, lang]);
  const lineTokens = useMemo(() => splitTokensByLine(tokens), [tokens]);
  const totalLines = lineTokens.length;
  const gutter = showLineNumbers ?? totalLines >= 4;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      
    }
  };

  const palette =
    tone === "danger"
      ? {
          wrapper: "border-red-500/30 bg-red-500/5",
          chrome: "bg-red-500/10 border-b border-red-500/20",
          label: "text-red-300",
        }
      : tone === "success"
        ? {
            wrapper: "border-emerald-500/30 bg-emerald-500/5",
            chrome: "bg-emerald-500/10 border-b border-emerald-500/20",
            label: "text-emerald-300",
          }
        : {
            wrapper: "border-surface-3 bg-surface-4/50",
            chrome: "bg-surface-3/70 border-b border-surface-3",
            label: "text-gray-400",
          };

  const preStyle: React.CSSProperties = {};
  if (maxHeight) preStyle.maxHeight = maxHeight;

  return (
    <div
      className={`group/code rounded-md border overflow-hidden shadow-[0_1px_0_rgba(255,255,255,0.02)_inset,0_2px_8px_-4px_rgba(0,0,0,0.4)] ${palette.wrapper}`}
    >
      {!compact && (
        <div className={`flex items-center gap-2 px-3 py-1.5 text-[11px] ${palette.chrome}`}>
          <span
            className={`inline-flex items-center gap-1 font-mono uppercase tracking-wider ${palette.label}`}
          >
            {filename ? <FileCode className="w-3 h-3 opacity-70" /> : null}
            {filename ?? label ?? langDisplay(lang)}
          </span>

          {filename && !label && (
            <span className="text-gray-600 font-mono lowercase">{langDisplay(lang)}</span>
          )}
          {filename && label && (
            <span className={`font-mono uppercase tracking-wider ${palette.label}`}>· {label}</span>
          )}

          <div className="ml-auto flex items-center gap-3">
            {totalLines > 1 && (
              <span className="text-gray-600 font-mono">
                {totalLines} {totalLines === 1 ? "line" : "lines"}
              </span>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex items-center gap-1 transition-colors ${
                copied ? "text-emerald-300" : "text-gray-500 hover:text-gray-200"
              }`}
              aria-label="Copy code"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copy
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-auto" style={preStyle}>
        <pre className="font-mono text-[12.5px] leading-[1.6]">
          <code>
            {gutter ? (
              <table className="border-collapse" style={{ width: "max-content", minWidth: "100%" }}>
                <tbody>
                  {lineTokens.map((line, i) => (
                    <tr key={i} className="align-top">
                      <td
                        className="select-none text-right pl-3 pr-3 text-gray-600 font-mono text-[11px] leading-[1.6] sticky left-0 bg-inherit"
                        style={{ width: "1%", whiteSpace: "nowrap" }}
                      >
                        {i + 1}
                      </td>
                      <td className="pl-0 pr-3 whitespace-pre">
                        {line.length === 0 ? (
                          <span>&nbsp;</span>
                        ) : (
                          line.map((t, j) => (
                            <span key={j} className={tokenClass(t.type)}>
                              {t.text}
                            </span>
                          ))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-3 py-2 whitespace-pre">
                {tokens.map((t, i) => (
                  <span key={i} className={tokenClass(t.type)}>
                    {t.text}
                  </span>
                ))}
              </div>
            )}
          </code>
        </pre>
      </div>
    </div>
  );
}
