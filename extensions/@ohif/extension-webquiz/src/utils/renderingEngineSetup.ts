// utils/renderingEngineSetup.ts
import { Enums } from "@cornerstonejs/core";
import { getRenderingEngine } from '@cornerstonejs/core';
import { RenderingEngine } from '@cornerstonejs/core';


const { ViewportType } = Enums;

export function setupRenderingEngine(viewportId) {
  const renderingEngineId = 'webquizEngine';
  const type = ViewportType.STACK;

  const element = document.getElementById('cornerstone-element') as HTMLDivElement;
  if (!element) {
    throw new Error("❌ cornerstone-element not found in DOM.");
  }

  const renderingEngine = getRenderingEngine(renderingEngineId) || new RenderingEngine(renderingEngineId);;

  renderingEngine.enableElement({
    viewportId,
    element,
    type
  });

  return renderingEngine;
}

