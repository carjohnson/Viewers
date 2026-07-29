import { useEffect, useState, useRef, useCallback } from 'react';

export function useViewportAndSeriesSync({
  viewportGridService,
  displaySetService,
  cornerstoneViewportService,
}) {
  const [activeViewportId, setActiveViewportId] = useState<string | null>(null);
  const [seriesUID, setSeriesUID] = useState<string | null>(null);
  const [activeViewportImageIds, setActiveViewportImageIds] = useState(null);

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
  // const updateActiveViewport = useCallback(
  //   (viewportId: string | null) => {
  //     setActiveViewportId(viewportId);
  //     activeViewportIdRef.current = viewportId;

  //           // Get the Cornerstone viewport
  //     const csViewport =
  //       cornerstoneViewportService.getCornerstoneViewport(viewportId);

  //     if (csViewport && 'getImageIds' in csViewport) {
  //       const imageIds = (csViewport as any).getImageIds() as string[];
  //       setActiveViewportImageIds(imageIds);
  //       // console.log(' *** IN HOOK FOR VIEWPORT imageId:', imageIds[0]);
  //     }

  //     // Optional: sync cornerstone viewport element
  //     if (viewportId && cornerstoneViewportService) {
  //       const viewportInfo = cornerstoneViewportService.getViewportInfo(viewportId);
  //       viewportInfo?.getElement?.() ?? viewportInfo?.element ?? null;
  //     }


  //     updateSeriesUID(viewportId);
  //   },
  //   [cornerstoneViewportService, updateSeriesUID]
  // );

const updateActiveViewport = useCallback(
  (viewportId: string | null) => {
    setActiveViewportId(viewportId);
    activeViewportIdRef.current = viewportId;

    // Update series UID first — this shouldn't depend on volume/actor readiness
    updateSeriesUID(viewportId);

    // Get the Cornerstone viewport
    const csViewport =
      cornerstoneViewportService.getCornerstoneViewport(viewportId);

    if (csViewport && 'getImageIds' in csViewport) {
      try {
        const imageIds = (csViewport as any).getImageIds() as string[];
        setActiveViewportImageIds(imageIds);
      } catch (err) {
        // Volume/actor not ready yet (e.g. mid layout change or series drop).
        // Don't crash the subscriber chain — just skip this update.
        console.warn(
          `[useViewportAndSeriesSync] getImageIds failed for viewport ${viewportId}, likely mid-transition:`,
          err
        );
        setActiveViewportImageIds(null);
      }
    }

    if (viewportId && cornerstoneViewportService) {
      const viewportInfo = cornerstoneViewportService.getViewportInfo(viewportId);
      viewportInfo?.getElement?.() ?? viewportInfo?.element ?? null;
    }
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
    activeViewportImageIds,
  };
}