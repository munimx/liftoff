'use client';

import { useState } from 'react';

interface YamlPreviewPanelProps {
  yaml: string | null;
  isValid: boolean;
  validationErrors: Array<{ nodeId: string; field: string; message: string }> | null;
}

/**
 * Collapsible panel that displays compiled YAML preview and validation errors.
 */
export function YamlPreviewPanel({ yaml, isValid, validationErrors }: YamlPreviewPanelProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  const errors = validationErrors ?? [];

  return (
    <div className="border-t border-border bg-card/80 backdrop-blur-sm">
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium
          text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={expanded ? 'rotate-90 transition-transform' : 'transition-transform'}>▶</span>
          <span>YAML Preview</span>
          {isValid && yaml && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
              ✓ Valid
            </span>
          )}
          {errors.length > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold">
              {errors.length} error{errors.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {yaml && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              void navigator.clipboard.writeText(yaml);
            }}
            className="text-[10px] px-2 py-0.5 rounded bg-accent hover:bg-accent/80 text-accent-foreground"
          >
            Copy
          </button>
        )}
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="max-h-64 overflow-auto border-t border-border">
          {errors.length > 0 && (
            <div className="px-4 py-2 bg-red-500/5 border-b border-red-500/10">
              <p className="text-[11px] font-semibold text-red-500 mb-1">Validation Errors</p>
              <ul className="space-y-0.5">
                {errors.map((err, idx) => (
                  <li key={idx} className="text-[11px] text-red-400">
                    <span className="font-mono">{err.field}</span>: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {yaml ? (
            <pre className="px-4 py-3 text-[11px] font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {yaml}
            </pre>
          ) : (
            <p className="px-4 py-3 text-xs text-muted-foreground italic">
              Add an App Service node and connect it to see the compiled YAML.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
