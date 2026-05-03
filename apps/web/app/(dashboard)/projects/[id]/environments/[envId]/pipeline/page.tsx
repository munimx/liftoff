'use client';

import { useParams } from 'next/navigation';
import { useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { PipelineNode, PipelineEdge, PipelineValidationError } from '@liftoff/shared';
import { Spinner } from '@/components/ui/spinner';
import { PipelineCanvas } from '@/components/pipeline/pipeline-canvas';
import {
  usePipelineGraph,
  useSavePipeline,
  useCompilePipeline,
  useDeployPipeline,
} from '@/hooks/queries/use-pipeline';

function resolveRouteParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] ?? '';
  return param ?? '';
}

/**
 * Pipeline builder page — wraps PipelineCanvas in ReactFlowProvider with data hooks.
 */
export default function PipelinePage(): JSX.Element {
  const params = useParams();
  const environmentId = resolveRouteParam(params.envId);

  const { data: graph, isLoading } = usePipelineGraph(environmentId);
  const saveMutation = useSavePipeline(environmentId);
  const compileMutation = useCompilePipeline(environmentId);
  const deployMutation = useDeployPipeline(environmentId);

  const handleSave = useCallback(
    (nodes: PipelineNode[], edges: PipelineEdge[]) => {
      saveMutation.mutate({ nodes, edges });
    },
    [saveMutation],
  );

  const handleCompile = useCallback(() => {
    compileMutation.mutate();
  }, [compileMutation]);

  const handleDeploy = useCallback(() => {
    deployMutation.mutate();
  }, [deployMutation]);

  if (isLoading || !graph) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const nodes = (graph.nodes ?? []) as PipelineNode[];
  const edges = (graph.edges ?? []) as PipelineEdge[];
  const yaml = graph.compiledYaml ?? null;
  const valid = graph.isValid;
  const errors = (graph.validationErrors ?? null) as PipelineValidationError[] | null;

  return (
    <ReactFlowProvider>
      <PipelineCanvas
        environmentId={environmentId}
        initialNodes={nodes}
        initialEdges={edges}
        compiledYaml={yaml}
        isValid={valid}
        validationErrors={errors}
        onSave={handleSave}
        onCompile={handleCompile}
        onDeploy={handleDeploy}
        isSaving={saveMutation.isPending}
        isCompiling={compileMutation.isPending}
        isDeploying={deployMutation.isPending}
      />
    </ReactFlowProvider>
  );
}
