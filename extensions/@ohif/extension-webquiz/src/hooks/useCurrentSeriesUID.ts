import { useState, useEffect } from 'react';

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
    updateSeriesUID(); // initial run

    const subscription = cornerstoneViewportService.subscribe(
      'event::cornerstoneViewportService:viewportDataChanged',
      updateSeriesUID
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [studyUID]);

  return seriesUID;
};