'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DeploymentLogViewerEntry {
  id: string;
  line: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'debug' | 'info' | 'warn' | 'error';
  source: string;
}

interface LogViewerProps {
  logs: DeploymentLogViewerEntry[];
}

const VIRTUALIZE_THRESHOLD = 5000;
const LINE_HEIGHT = 22;
const VIEWPORT_HEIGHT = 420;
const OVERSCAN = 30;

/**
 * Deployment log viewer with optional virtualized rendering for very large log sets.
 */
export function LogViewer({ logs }: LogViewerProps): JSX.Element {
  const [pauseAutoScroll, setPauseAutoScroll] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const shouldVirtualize = logs.length > VIRTUALIZE_THRESHOLD;
  const totalHeight = logs.length * LINE_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    logs.length,
    Math.ceil((scrollTop + VIEWPORT_HEIGHT) / LINE_HEIGHT) + OVERSCAN,
  );

  const visibleEntries = useMemo(() => {
    if (!shouldVirtualize) {
      return logs.map((entry, index) => ({
        entry,
        offsetTop: index * LINE_HEIGHT,
      }));
    }

    return logs.slice(startIndex, endIndex).map((entry, index) => ({
      entry,
      offsetTop: (startIndex + index) * LINE_HEIGHT,
    }));
  }, [endIndex, logs, shouldVirtualize, startIndex]);

  useEffect(() => {
    if (pauseAutoScroll || !containerRef.current) {
      return;
    }

    const node = containerRef.current;
    node.scrollTop = node.scrollHeight;
  }, [logs, pauseAutoScroll]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {logs.length.toLocaleString()} log line{logs.length === 1 ? '' : 's'}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPauseAutoScroll((previousValue) => !previousValue)}
        >
          {pauseAutoScroll ? 'Resume auto-scroll' : 'Pause auto-scroll'}
        </Button>
      </div>

      <div
        ref={containerRef}
        className="overflow-auto rounded-md border bg-muted/30 font-mono text-xs"
        style={{ height: `${VIEWPORT_HEIGHT}px` }}
        onScroll={(event) => {
          setScrollTop(event.currentTarget.scrollTop);
        }}
      >
        {shouldVirtualize ? (
          <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
            {visibleEntries.map(({ entry, offsetTop }) => (
              <div
                key={entry.id}
                style={{
                  position: 'absolute',
                  top: `${offsetTop}px`,
                  left: 0,
                  right: 0,
                  height: `${LINE_HEIGHT}px`,
                }}
                className={cn(
                  'flex items-center gap-2 px-3',
                  resolveLevelClassName(entry.level),
                )}
              >
                <span className="text-[10px] text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-[10px] uppercase text-muted-foreground">{entry.source}</span>
                <span className="truncate">{entry.line}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-0.5 p-3">
            {logs.map((entry) => (
              <div key={entry.id} className={cn('flex gap-2 leading-5', resolveLevelClassName(entry.level))}>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                  {entry.source}
                </span>
                <span className="break-all">{entry.line}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function resolveLevelClassName(
  level: DeploymentLogViewerEntry['level'],
): 'text-slate-200' | 'text-blue-300' | 'text-amber-300' | 'text-red-300' {
  const normalizedLevel = level.toUpperCase();
  if (normalizedLevel === 'DEBUG') {
    return 'text-blue-300';
  }
  if (normalizedLevel === 'WARN') {
    return 'text-amber-300';
  }
  if (normalizedLevel === 'ERROR') {
    return 'text-red-300';
  }
  return 'text-slate-200';
}
