/**
 * Custom hook for retrieving study-level metadata from OHIF's displaySetService.
 *
 * This hook polls the viewer's active display sets until valid study data is available.
 * OHIF first completes rendering of the extension prior to loading images.
 * It extracts:
 * - studyUID: Unique identifier for the current study
 * - frameUID: Frame of reference UID from the image plane metadata
 *
 * Note:
 * - This hook intentionally excludes patientName and patientId, which are retrieved separately
 *   via `usePatientInfo()` in the consuming component.
 * - Polling is capped at a maximum number of attempts to avoid infinite loops.
 * - The hook returns `null` until valid data is found, allowing components to handle loading states.
 *
 * Usage:
 *   const studyInfo = useStudyInfo();
 *
 * Combine with:
 *   const { patientInfo } = usePatientInfo();
 *   const fullInfo = { ...studyInfo, patientName, patientId };
 *
 * This separation ensures React hooks are used safely and avoids calling hooks inside polling loops.
 */
import { useEffect, useState } from 'react';
import { useSystem } from '@ohif/core';
import { metaData } from '@cornerstonejs/core';

export function useStudyInfo() {
  const { servicesManager } = useSystem();
  const displaySetService = servicesManager.services.displaySetService;

  const [studyInfo, setStudyInfo] = useState(null);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 20;

    const poll = setInterval(() => {
      attempts++;
      const activeDisplaySets = displaySetService.getActiveDisplaySets();
      const firstDisplaySet = activeDisplaySets?.[0];

      if (!firstDisplaySet || !firstDisplaySet.images?.length) {
        console.log(`⏳ Waiting for display sets... attempt ${attempts}`);
        if (attempts >= maxAttempts) {
          console.warn('❌ Giving up on study info after max attempts');
          clearInterval(poll);
        }
        return;
      }

      const studyUID = firstDisplaySet.StudyInstanceUID ?? null;
      const imageId = firstDisplaySet.images[0].imageId;
      const imagePlaneModule = metaData.get('imagePlaneModule', imageId);
      const frameUID = imagePlaneModule?.frameOfReferenceUID ?? null;

      const info = {
        studyUID,
        frameUID,
      };

      console.log('✅ Partial study info ready:', info);
      setStudyInfo(info);
      clearInterval(poll);
    }, 300);

    return () => clearInterval(poll);
  }, []);

  return studyInfo;
}