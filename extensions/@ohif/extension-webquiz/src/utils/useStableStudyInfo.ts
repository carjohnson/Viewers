// // utils/useStableStudyInfo.ts
// import { useEffect, useRef } from 'react';
// import { useSystem } from '@ohif/core';
// import { usePatientInfo } from '@ohif/extension-default';
// import { metaData } from '@cornerstonejs/core';


// export function useStableStudyInfo() {
//   const { patientInfo } = usePatientInfo();
//   // const { StudyInstanceUID, FrameOfReferenceUID } = metaData() ?? {};
//   const { servicesManager } = useSystem();
//   const displaySetService = servicesManager.services.displaySetService;
//   const activeDisplaySets = displaySetService.getActiveDisplaySets();
//   const studyInstanceUID = activeDisplaySets[0]?.StudyInstanceUID;

//   interface Image {
//     imageId: string;
//   }

//   interface DisplaySetWithImages {
//     images?: Image[];
//   }

//   // Get imageId from the first image in the first display set
//   const firstDisplaySet = activeDisplaySets[0] as DisplaySetWithImages | undefined;
//   const imageId = firstDisplaySet?.images?.[0]?.imageId;
//   const imagePlaneModule = imageId ? metaData.get('imagePlaneModule', imageId) : null;
//   const frameOfReferenceUID = imagePlaneModule?.frameOfReferenceUID ?? null;


//   const stableInfoRef = useRef<{
//     patientName: string | null;
//     patientId: string | null;
//     studyUID: string | null;
//     frameUID: string | null;
//   }>({
//     patientName: null,
//     patientId: null,
//     studyUID: null,
//     frameUID: null,
//   });

//   useEffect(() => {
//     stableInfoRef.current.patientName = patientInfo?.PatientName ?? null;
//     stableInfoRef.current.patientId = patientInfo?.PatientID ?? null;
//     stableInfoRef.current.studyUID = studyInstanceUID ?? null;
//     stableInfoRef.current.frameUID = frameOfReferenceUID ?? null;

//     console.log("📦 Stable study info updated:", stableInfoRef.current);
//   }, [patientInfo, studyInstanceUID, frameOfReferenceUID]);

//   return stableInfoRef.current;
// }


// utils/useStableStudyInfo.ts
import { useEffect, useState } from 'react';
import { useSystem } from '@ohif/core';
import { usePatientInfo } from '@ohif/extension-default';
import { metaData } from '@cornerstonejs/core';

interface Image {
  imageId: string;
}
interface DisplaySetWithImages {
  images?: Image[];
}

export function useStableStudyInfo() {
  const { patientInfo } = usePatientInfo();
  const { servicesManager } = useSystem();
  const displaySetService = servicesManager.services.displaySetService;
  const activeDisplaySets = displaySetService.getActiveDisplaySets() as DisplaySetWithImages[];
  const ds = displaySetService.getActiveDisplaySets();

  const [studyInfo, setStudyInfo] = useState({
    patientName: null,
    patientId: null,
    studyUID: null,
    frameUID: null,
  });

  useEffect(() => {
    if (!activeDisplaySets.length) { 
      console.log(" XXXX NO ACTIVE DISPLAY SETS = NO STUDY INFO")
      return; 
    }
    const firstDisplaySet = activeDisplaySets[0];
    const studyUID = ds[0]?.StudyInstanceUID ?? null;

    let frameUID = null;
    const imageId = firstDisplaySet?.images?.[0]?.imageId;
    if (imageId) {
      const imagePlaneModule = metaData.get('imagePlaneModule', imageId);
      frameUID = imagePlaneModule?.frameOfReferenceUID ?? null;
    }

    setStudyInfo({
      patientName: patientInfo?.PatientName ?? null,
      patientId: patientInfo?.PatientID ?? null,
      studyUID,
      frameUID,
    });
  }, [patientInfo, activeDisplaySets]);

  return studyInfo;
}