import { useEffect, useState, useRef, useCallback } from 'react';

export function useViewportAndSeriesSync({
  viewportGridService,
  displaySetService,
  cornerstoneViewportService,
}) {
  const [activeViewportId, setActiveViewportId] = useState<string | null>(null);
  const [seriesUID, setSeriesUID] = useState<string | null>(null);

  const activeViewportIdRef = useRef<string | null>(null);

  // ---------------------------------------------------------
  // Helper: compute the SeriesInstanceUID for a given viewport
  // ---------------------------------------------------------
  const updateSeriesUID = useCallback(
    (viewportId: string | null) => {
      if (!viewportId) {
        setSeriesUID(null);
        return;
      }

      const displaySetUIDs =
        viewportGridService.getDisplaySetsUIDsForViewport(viewportId);

      const uid = displaySetUIDs?.[0]
        ? displaySetService.getDisplaySetByUID(displaySetUIDs[0])
            ?.instances?.[0]?.SeriesInstanceUID
        : null;

      setSeriesUID(prev => (prev === uid ? prev : uid));
    },
    [viewportGridService, displaySetService]
  );

  // ---------------------------------------------------------
  // Main orchestrator: updates viewport + series together
  // ---------------------------------------------------------
  const updateActiveViewport = useCallback(
    (viewportId: string | null) => {
      setActiveViewportId(viewportId);
      activeViewportIdRef.current = viewportId;

      // Optional: sync cornerstone viewport element
      if (viewportId && cornerstoneViewportService) {
        const viewportInfo = cornerstoneViewportService.getViewportInfo(viewportId);
        viewportInfo?.getElement?.() ?? viewportInfo?.element ?? null;
      }

      updateSeriesUID(viewportId);
    },
    [cornerstoneViewportService, updateSeriesUID]
  );

  // ---------------------------------------------------------
  // Subscriptions: single point for all viewport events
  // ---------------------------------------------------------
  useEffect(() => {
    if (!viewportGridService) return;

    const subs = [
      viewportGridService.subscribe(
        viewportGridService.EVENTS.VIEWPORTS_READY,
        () => {
          updateActiveViewport(viewportGridService.getActiveViewportId());
        }
      ),

      viewportGridService.subscribe(
        viewportGridService.EVENTS.GRID_STATE_CHANGED,
        () => {
          updateActiveViewport(viewportGridService.getActiveViewportId());
        }
      ),

      viewportGridService.subscribe(
        viewportGridService.EVENTS.ACTIVE_VIEWPORT_ID_CHANGED,
        evt => updateActiveViewport(evt.viewportId)
      ),
    ];

    // Initial sync
    updateActiveViewport(viewportGridService.getActiveViewportId());

    return () => subs.forEach(s => s.unsubscribe());
  }, [viewportGridService, updateActiveViewport]);

  return {
    activeViewportId,
    activeViewportIdRef,
    seriesInstanceUID: seriesUID,
  };
}