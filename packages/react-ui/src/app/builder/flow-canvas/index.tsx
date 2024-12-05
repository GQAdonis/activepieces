import { ReactFlow, Background, useReactFlow, SelectionMode, OnSelectionChangeParams, useOnSelectionChange, useStoreApi,  } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import React, { useCallback, useEffect, useMemo, useRef, useState,  } from 'react';
import { usePrevious } from 'react-use';

import { ActionType, flowStructureUtil, FlowVersion, isFlowStateTerminal, TriggerType } from '@activepieces/shared';

import { flowRunUtils } from '../../../features/flow-runs/lib/flow-run-utils';
import { useBuilderStateContext } from '../builder-hooks';

import { flowUtilConsts } from './consts';
import { flowCanvasUtils } from './flow-canvas-utils';
import { FlowDragLayer } from './flow-drag-layer';
import { AboveFlowWidgets } from './widgets';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import { BuilderContextMenuContent } from './builder-context-menu-content';
import { ApNode, ApNodeType } from './types';

const createGraphKey = (flowVersion:FlowVersion)=>{
    return flowStructureUtil.getAllSteps(flowVersion.trigger).reduce((acc,step)=>{
     return `${acc}-${step.displayName}-${step.type}-${step.type === ActionType.PIECE?step.settings.pieceName: ''}-${step.type !== TriggerType.EMPTY && step.type !== TriggerType.PIECE? step.skip:'unskipable'}`
    },'')
}
export const FlowCanvas = React.memo(
  ({
    setHasCanvasBeenInitialised,
    lefSideBarContainerWidth,
  }: {
    setHasCanvasBeenInitialised: (value: boolean) => void;
    lefSideBarContainerWidth: number;
  }) => {
    const [allowCanvasPanning, flowVersion, run,readonly,setSelectedNodes, selectedNodes,applyOperation,selectedStep,setRightSidebar ] = useBuilderStateContext((state) => {
      return [state.allowCanvasPanning, state.flowVersion, state.run,state.readonly,state.setSelectedNodes, state.selectedNodes,state.applyOperation, state.selectedStep,state.setRightSidebar];
    });

    const previousRun = usePrevious(run);
    const { fitView, getViewport, setViewport } = useReactFlow();
    if (
      (run && previousRun?.id !== run.id && isFlowStateTerminal(run.status)) ||
      (run &&
        previousRun &&
        !isFlowStateTerminal(previousRun.status) &&
        isFlowStateTerminal(run.status))
    ) {
      const failedStep = run.steps
        ? flowRunUtils.findFailedStepInOutput(run.steps)
        : null;
      if (failedStep) {
        setTimeout(() => {
          fitView(flowCanvasUtils.createFocusStepInGraphParams(failedStep));
        });
      }
    }
    const containerRef = useRef<HTMLDivElement>(null);
    const containerSizeRef = useRef({
      width: 0,
      height: 0,
    });
    useEffect(() => {
      if (!containerRef.current) return;

      const resizeObserver = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;

        setHasCanvasBeenInitialised(true);
        const { x, y, zoom } = getViewport();

        if (containerRef.current && width !== containerSizeRef.current.width) {
          const newX = x + (width - containerSizeRef.current.width) / 2;
          // Update the viewport to keep content centered without affecting zoom
          setViewport({ x: newX, y, zoom });
        }
        // Adjust x/y values based on the new size and keep the same zoom level

        containerSizeRef.current = {
          width,
          height,
        };
      });

      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }, [setViewport, getViewport]);
   
    const onSelectionChange = useCallback((ev:OnSelectionChangeParams)=>{
      setSelectedNodes(ev.nodes as ApNode[]);
      },[])

    const graphKey= createGraphKey(flowVersion)
    const graph = useMemo(()=>{
      return flowCanvasUtils.convertFlowVersionToGraph(flowVersion);
    },[graphKey]);

    return (
      <div
        ref={containerRef}
        className="size-full relative overflow-hidden z-50"
      >
        <FlowDragLayer lefSideBarContainerWidth={lefSideBarContainerWidth}>
         <ContextMenu>
         <ContextMenuTrigger>
          <ReactFlow
            onPaneClick={()=>{
              setSelectedNodes([]);
            }}
            
            nodeTypes={flowUtilConsts.nodeTypes}
            nodes={graph.nodes}
            edgeTypes={flowUtilConsts.edgeTypes}
            edges={graph.edges}
            draggable={false}
            edgesFocusable={false}
            elevateEdgesOnSelect={false}
            maxZoom={1.5}
            minZoom={0.5}
            panOnDrag={allowCanvasPanning}
            zoomOnDoubleClick={false}
            panOnScroll={true}
            fitView={false}
            nodesConnectable={false}
            elementsSelectable={true}
            nodesDraggable={false}
            nodesFocusable={false}
            selectNodesOnDrag={!readonly}
            selectionMode={SelectionMode.Partial}
            selectionKeyCode={['Shift','ControlLeft']}
            onSelectionChange={onSelectionChange}
    
          >
            <AboveFlowWidgets></AboveFlowWidgets>
            <Background />
          </ReactFlow>
          </ContextMenuTrigger>
 
            <ContextMenuContent  >
            <BuilderContextMenuContent selectedNodes={selectedNodes} applyOperation={applyOperation} selectedStep={selectedStep} setRightSidebar={setRightSidebar}  > 
            </BuilderContextMenuContent>
            </ContextMenuContent>
       
   
      </ContextMenu>

        </FlowDragLayer>
      </div>
    );
  },
);

FlowCanvas.displayName = 'FlowCanvas';
