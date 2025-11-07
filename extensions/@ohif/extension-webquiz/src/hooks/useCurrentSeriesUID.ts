import { useState, useEffect, useRef } from 'react';


export const useCurrentSeriesUID = ({
  viewportGridService,
  displaySetService,
  cornerstoneViewportService,
  studyUID,
}: {
  viewportGridService: any;
  displaySetService: any;
  cornerstoneViewportService: any;
  studyUID: string | null;
}): string | null => {
  const [seriesUID, setSeriesUID] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const updateSeriesUID = () => {
    const activeViewportId = viewportGridService.getActiveViewportId();
    if (!activeViewportId) {
      console.warn('⚠️ No active viewport available yet.');
      return;
    }

    const displaySetUIDs = viewportGridService.getDisplaySetsUIDsForViewport(activeViewportId);
    if (!displaySetUIDs?.length) {
      console.warn(`⚠️ No display sets found for viewport ${activeViewportId}`);
      return;
    }

    const viewportDisplaySets = displaySetUIDs.map(uid =>
      displaySetService.getDisplaySetByUID(uid)
    );

    const uid = viewportDisplaySets?.[0]?.instances?.[0]?.SeriesInstanceUID;
    if (!uid) {
      console.warn('⚠️ SeriesInstanceUID not found in display set.');
      return;
    }
    setSeriesUID(uid);
  };


  useEffect(() => {
    if (!studyUID) return;

    
    updateSeriesUID();

    // Initial hydration delay
    const readySub = viewportGridService.subscribe(
      viewportGridService.EVENTS.VIEWPORTS_READY,
      () => {
        timeoutRef.current = setTimeout(updateSeriesUID, 300);
      }
    );

    // Ongoing triggers
    const dataSub = cornerstoneViewportService.subscribe(
      cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
      updateSeriesUID
    );

    const activeSub = viewportGridService.subscribe(
      viewportGridService.EVENTS.ACTIVE_VIEWPORT_ID_CHANGED,
      updateSeriesUID
    );

    return () => {
      readySub.unsubscribe();
      dataSub.unsubscribe();
      activeSub.unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };


}, [studyUID]);

  return seriesUID;
};