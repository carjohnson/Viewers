// utils/renderingEngineSetup.ts
import { RenderingEngine } from '@cornerstonejs/core';
import { Enums } from "@cornerstonejs/core";


const { ViewportType } = Enums;

export function setupRenderingEngine() {
  const renderingEngineId = 'webquizEngine';
  const viewportId = 'webquizViewport';
  const type = ViewportType.STACK;

  const element = document.getElementById('cornerstone-element') as HTMLDivElement;
  if (!element) {
    throw new Error("❌ cornerstone-element not found in DOM.");
  }

  const renderingEngine = new RenderingEngine(renderingEngineId);

  renderingEngine.enableElement({
    viewportId,
    element,
    type
  });

  return renderingEngine;
}

