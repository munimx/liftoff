'use client';

import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Node as RFNode } from '@xyflow/react';
import type { PipelineNodeType } from '@liftoff/shared';

interface NodeConfigPanelProps {
  /** Currently selected node */
  node: RFNode;
}

/**
 * Panel that renders editable configuration for the currently selected node.
 */
export function NodeConfigPanel({ node }: NodeConfigPanelProps): JSX.Element {
  const { setNodes } = useReactFlow();
  const nodeType = node.type as PipelineNodeType;

  const updateNodeData = useCallback(
    (key: string, value: unknown) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id ? { ...n, data: { ...n.data, [key]: value } } : n,
        ),
      );
    },
    [node.id, setNodes],
  );

  return (
    <div className="w-72 shrink-0 border-l border-border bg-card/50 backdrop-blur-sm overflow-y-auto">
      <div className="p-3 border-b border-border">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Configure Node
        </h3>
        <p className="text-sm font-semibold text-foreground mt-1">{nodeType}</p>
      </div>

      <div className="p-3 space-y-3">
        {renderFields(nodeType, node.data as Record<string, unknown>, updateNodeData)}
      </div>
    </div>
  );
}

/** Renders form fields based on node type. */
function renderFields(
  type: PipelineNodeType,
  data: Record<string, unknown>,
  update: (key: string, value: unknown) => void,
): JSX.Element {
  switch (type) {
    case 'GitHubPushTrigger':
      return (
        <div className="space-y-3">
          <Field label="Branch" value={(data.branch as string) ?? 'main'} onChange={(v) => update('branch', v)} />
        </div>
      );

    case 'ScheduleTrigger':
      return (
        <div className="space-y-3">
          <Field label="Cron Expression" value={(data.cron as string) ?? ''} onChange={(v) => update('cron', v)} placeholder="0 2 * * *" />
        </div>
      );

    case 'ManualTrigger':
      return <p className="text-xs text-muted-foreground">No configuration needed.</p>;

    case 'DockerBuild':
      return (
        <div className="space-y-3">
          <Field label="Dockerfile Path" value={(data.dockerfilePath as string) ?? 'Dockerfile'} onChange={(v) => update('dockerfilePath', v)} />
          <Field label="Build Context" value={(data.context as string) ?? '.'} onChange={(v) => update('context', v)} />
        </div>
      );

    case 'AutoDetectBuild':
      return <p className="text-xs text-muted-foreground">Automatically detects build system from project files.</p>;

    case 'AppService':
      return (
        <div className="space-y-3">
          <Field label="Service Name" value={(data.name as string) ?? ''} onChange={(v) => update('name', v)} placeholder="my-app" />
          <NumberField label="Port" value={(data.port as number) ?? 3000} onChange={(v) => update('port', v)} min={1} max={65535} />
          <SelectField
            label="Instance Size"
            value={(data.instanceSize as string) ?? 'apps-s-1vcpu-0.5gb'}
            options={[
              { value: 'apps-s-1vcpu-0.5gb', label: 'Starter (1 vCPU, 512MB)' },
              { value: 'apps-s-1vcpu-1gb', label: 'Basic (1 vCPU, 1GB)' },
              { value: 'apps-s-1vcpu-2gb', label: 'Pro (1 vCPU, 2GB)' },
              { value: 'apps-s-2vcpu-4gb', label: 'Pro+ (2 vCPU, 4GB)' },
            ]}
            onChange={(v) => update('instanceSize', v)}
          />
          <NumberField label="Replicas" value={(data.replicas as number) ?? 1} onChange={(v) => update('replicas', v)} min={1} max={10} />
          <Field label="Health Check Path" value={(data.healthCheckPath as string) ?? '/health'} onChange={(v) => update('healthCheckPath', v)} />
          <SelectField
            label="Region"
            value={(data.region as string) ?? 'nyc3'}
            options={[
              { value: 'nyc3', label: 'New York (NYC3)' },
              { value: 'sfo3', label: 'San Francisco (SFO3)' },
              { value: 'ams3', label: 'Amsterdam (AMS3)' },
              { value: 'sgp1', label: 'Singapore (SGP1)' },
              { value: 'lon1', label: 'London (LON1)' },
              { value: 'fra1', label: 'Frankfurt (FRA1)' },
              { value: 'blr1', label: 'Bangalore (BLR1)' },
              { value: 'tor1', label: 'Toronto (TOR1)' },
              { value: 'syd1', label: 'Sydney (SYD1)' },
            ]}
            onChange={(v) => update('region', v)}
          />
        </div>
      );

    case 'PostgresDatabase':
      return (
        <div className="space-y-3">
          <SelectField
            label="Instance Size"
            value={(data.size as string) ?? 'db-s-1vcpu-1gb'}
            options={[
              { value: 'db-s-1vcpu-1gb', label: 'Basic (1 vCPU, 1GB)' },
              { value: 'db-s-1vcpu-2gb', label: 'Standard (1 vCPU, 2GB)' },
              { value: 'db-s-2vcpu-4gb', label: 'Pro (2 vCPU, 4GB)' },
            ]}
            onChange={(v) => update('size', v)}
          />
          <SelectField
            label="PostgreSQL Version"
            value={(data.version as string) ?? '15'}
            options={[
              { value: '14', label: 'PostgreSQL 14' },
              { value: '15', label: 'PostgreSQL 15' },
              { value: '16', label: 'PostgreSQL 16' },
            ]}
            onChange={(v) => update('version', v)}
          />
        </div>
      );

    case 'SpacesBucket':
      return (
        <div className="space-y-3">
          <SelectField
            label="Region"
            value={(data.region as string) ?? 'nyc3'}
            options={[
              { value: 'nyc3', label: 'New York (NYC3)' },
              { value: 'sfo3', label: 'San Francisco (SFO3)' },
              { value: 'ams3', label: 'Amsterdam (AMS3)' },
              { value: 'sgp1', label: 'Singapore (SGP1)' },
            ]}
            onChange={(v) => update('region', v)}
          />
        </div>
      );

    case 'CustomDomain':
      return (
        <div className="space-y-3">
          <Field label="Domain" value={(data.domain as string) ?? ''} onChange={(v) => update('domain', v)} placeholder="app.example.com" />
        </div>
      );

    case 'EnvVars':
      return <EnvVarsEditor data={data} update={update} />;

    case 'Secret':
      return (
        <div className="space-y-3">
          <Field label="Secret Name" value={(data.name as string) ?? ''} onChange={(v) => update('name', v)} placeholder="DATABASE_URL" />
        </div>
      );

    default:
      return <p className="text-xs text-muted-foreground">No configuration available.</p>;
  }
}

/* ─── Shared Input Primitives ─── */

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}): JSX.Element {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <input
        type="text"
        className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm
          text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1
          focus:ring-offset-background transition-all"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}): JSX.Element {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <input
        type="number"
        className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm
          text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1
          focus:ring-offset-background transition-all"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}): JSX.Element {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <select
        className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm
          text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1
          focus:ring-offset-background transition-all"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Inline editor for environment variable key-value pairs.
 */
function EnvVarsEditor({
  data,
  update,
}: {
  data: Record<string, unknown>;
  update: (key: string, value: unknown) => void;
}): JSX.Element {
  const vars = (data.variables as Record<string, string>) ?? {};
  const entries = Object.entries(vars);

  const setVar = (oldKey: string, newKey: string, val: string) => {
    const next = { ...vars };
    if (oldKey !== newKey) delete next[oldKey];
    next[newKey] = val;
    update('variables', next);
  };

  const removeVar = (key: string) => {
    const next = { ...vars };
    delete next[key];
    update('variables', next);
  };

  const addVar = () => {
    const key = `NEW_VAR_${entries.length}`;
    update('variables', { ...vars, [key]: '' });
  };

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block">
        Variables
      </span>
      {entries.map(([k, v], idx) => (
        <div key={idx} className="flex gap-1 items-center">
          <input
            className="flex-1 rounded border border-input bg-background px-1.5 py-1 text-[11px]
              text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={k}
            onChange={(e) => setVar(k, e.target.value, v)}
            placeholder="KEY"
          />
          <input
            className="flex-1 rounded border border-input bg-background px-1.5 py-1 text-[11px]
              text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={v}
            onChange={(e) => setVar(k, k, e.target.value)}
            placeholder="value"
          />
          <button
            onClick={() => removeVar(k)}
            className="text-muted-foreground hover:text-destructive text-xs px-1"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={addVar}
        className="w-full text-[11px] py-1 rounded border border-dashed border-border
          text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        + Add Variable
      </button>
    </div>
  );
}
