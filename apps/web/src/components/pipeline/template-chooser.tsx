'use client';

import { PIPELINE_TEMPLATES, type PipelineTemplate } from './pipeline-templates';

interface TemplateChooserProps {
  onSelect: (template: PipelineTemplate) => void;
  onClose: () => void;
}

/**
 * Overlay dialog to choose a pipeline template.
 */
export function TemplateChooser({ onSelect, onClose }: TemplateChooserProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">Start from a Template</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose a pre-built pipeline or start from scratch
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-lg px-2"
          >
            ✕
          </button>
        </div>

        {/* Template grid */}
        <div className="p-4 grid gap-3 max-h-[400px] overflow-y-auto">
          {/* Blank canvas option */}
          <button
            onClick={onClose}
            className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-border
              hover:border-foreground/20 hover:bg-accent/30 transition-all text-left group"
          >
            <span className="text-2xl">✨</span>
            <div>
              <p className="text-sm font-semibold text-foreground group-hover:text-foreground">
                Blank Canvas
              </p>
              <p className="text-xs text-muted-foreground">Start from scratch and build your own pipeline</p>
            </div>
          </button>

          {PIPELINE_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className="flex items-center gap-4 p-4 rounded-xl border border-border
                hover:border-primary/30 hover:bg-accent/30 hover:shadow-md
                transition-all text-left group"
            >
              <span className="text-2xl">{template.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {template.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
                    {template.nodes.length} nodes
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
                    {template.edges.length} edges
                  </span>
                </div>
              </div>
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
