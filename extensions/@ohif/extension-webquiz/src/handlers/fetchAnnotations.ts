// src/handlers/fetchAnnotations.ts
import CornerstoneViewportService from 'extensions/cornerstone/src/services/ViewportService/CornerstoneViewportService';
import { buildDropdownSelectionMapFromFetched } from '../utils/annotationUtils';
import * as cornerstone from '@cornerstonejs/core';
import { extensionManager } from 'platform/app/src/App';
import { Enums as CSExtensionEnums } from '@ohif/extension-cornerstone';



export const fetchAnnotationsFromDB = async ({
  userInfo,
  patientName,
  baseUrl,
  setListOfUsersAnnotations,
  setDropdownSelectionMap,
  annotation,
  setAnnotationsLoaded,
  listOfUsersAnnotationsRef,
}: {
  userInfo: { username: string; role: string };
  patientName: string;
  baseUrl: string;
  setListOfUsersAnnotations: (list: any[]) => void;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  annotation: any;
  setAnnotationsLoaded: (loaded: boolean) => void;
  listOfUsersAnnotationsRef: React.MutableRefObject<Record<string, any> | null>;
}) => {
  const username = userInfo.role === 'reader' ? userInfo.username : 'all';

  try {
    console.log(' *** IN FETCH ');
    const response = await fetch(
      `${baseUrl}/webquiz/list-users-annotations?username=${username}&patientid=${patientName}`,
      { credentials: 'include' }
    );

    if (!response.ok) throw new Error('Failed to fetch annotations from DB');

    const { payload: annotationsList, legend } = await response.json();

    setListOfUsersAnnotations(annotationsList);
    listOfUsersAnnotationsRef.current = annotationsList;

    const newMap = buildDropdownSelectionMapFromFetched(annotationsList);
    setDropdownSelectionMap(newMap);

    // annotationsList.forEach(({ data, color }) => {
    //   data.forEach(annotationObj => {
    //     if (
    //       annotationObj &&
    //       typeof annotationObj.annotationUID === 'string' &&
    //       annotationObj.annotationUID.length > 0
    //     ) {
    //       annotation.config.style.setAnnotationStyles(annotationObj.annotationUID, { color });
    //       annotation.state.addAnnotation(annotationObj);
    //     }
    //   });
    // });

    setAnnotationsLoaded(true);

    window.parent.postMessage({ type: 'update-legend', legend }, '*');
  } catch (error) {
    console.error('❌ Error fetching annotations:', error);
  }
};


//=========================================================
// export const fetchAnnotationsFromDB = async ({
//   userInfo,
//   patientName,
//   baseUrl,
//   setListOfUsersAnnotations,
//   setDropdownSelectionMap,
//   setAnnotationsLoaded,
//   listOfUsersAnnotationsRef,
//   measurementService,
//   viewportGridService,
//   displaySetService,  // Pass utilities.DisplaySetService
//               viewportId,
//             viewportElement,
// }: {
//   userInfo: { username: string; role: string };
//   patientName: string;
//   baseUrl: string;
//   setListOfUsersAnnotations: (list: any[]) => void;
//   setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
//   setAnnotationsLoaded: (loaded: boolean) => void;
//   listOfUsersAnnotationsRef: React.MutableRefObject<Record<string, any> | null>;
//   measurementService: any;
//   viewportGridService: any;
//   displaySetService: any;
//   viewportId: any;
//   viewportElement: any;
// }) => {
//   const username = userInfo.role === 'reader' ? userInfo.username : 'all';
//   const csToolsSource = measurementService.getSource('CornerstoneTools', '4'); // Existing source
//   console.log(' *** IN FETCH ... activeViewportID:',viewportId);
//   try {

//     const response = await fetch(
//       `${baseUrl}/webquiz/list-users-annotations?username=${username}&patientid=${patientName}`,
//       { credentials: 'include' }
//     );

//     if (!response.ok) throw new Error('Failed to fetch annotations from DB');

    
//     const { payload: annotationsList, legend } = await response.json();
    
//     // ... set state ...

//     setListOfUsersAnnotations(annotationsList);
//     listOfUsersAnnotationsRef.current = annotationsList;

//     const newMap = buildDropdownSelectionMapFromFetched(annotationsList);
//     setDropdownSelectionMap(newMap);

    
//     // Transform DB data to OHIF measurements
//     annotationsList.forEach(({ data, color }) => {
//       data.forEach(async (annotationObj) => {
//         if (!annotationObj?.annotationUID) return;
//         console.log('📦 Raw DB annotation:', annotationObj);

//         // // 1. Build OHIF measurement from your DB data
//         // const measurement = buildMeasurementFromDB(annotationObj, displaySetService, currentVpId);
//         // console.log('🛠️ Converted measurement:', measurement);
        
//         // // 2. Add via MeasurementService (fires MEASUREMENT_ADDED, creates annotation)
//         // measurementService.addMeasurement(csToolsSource, 'Length', measurement);
//         // console.log('✅ Added measurement to service:', {
//         //   source: csToolsSource,
//         //   type: 'Length',
//         //   measurement,
//         // });

//         // // 3. Apply custom style AFTER it's added
//         // setTimeout(() => {
//         //   annotationObj.config.style.setAnnotationStyles(annotationObj.annotationUID, { color });
//         // }, 100);
//       });
//     });

//     setAnnotationsLoaded(true);

//   } catch (error) {
//     console.error('❌ Error fetching annotations:', error);
//   }

// };


//=========================================================
export const convertAnnotationsToMeasurements = ({
  annotationsList,
  measurementService,
  displaySetService,
}: {
  annotationsList: any[];
  measurementService: any;
  displaySetService: any;
}) => {
  console.log(' *** IN CONVERT TO MEASUREMENTS ... annList', annotationsList);
  const { 
    CORNERSTONE_3D_TOOLS_SOURCE_NAME,
    CORNERSTONE_3D_TOOLS_SOURCE_VERSION,
  } = CSExtensionEnums;



  const csToolsSource = measurementService.getSource(CORNERSTONE_3D_TOOLS_SOURCE_NAME, CORNERSTONE_3D_TOOLS_SOURCE_VERSION);
  if (!csToolsSource) {
    console.error('CornerstoneTools source not found');
    return;
  }

  const mappings = measurementService.getSourceMappings(CORNERSTONE_3D_TOOLS_SOURCE_NAME,CORNERSTONE_3D_TOOLS_SOURCE_VERSION);
  // const matchingMapping = mappings.find(m => m.annotationType === annotationType);
  const matchingMapping = mappings.find(m => m.annotationType === "Length");


  annotationsList.forEach(({ data, color }) => {
    data.forEach((annotationObj: any) => {
      if (!annotationObj?.annotationUID) return;

      console.log('📦 Raw DB annotation:', annotationObj);

      // Build OHIF measurement
      // NOTE: The variable name 'annotation' is required for the toMeasurementSchema function
      const annotation = annotationToRawMeasurement(
                annotationObj,
                displaySetService,
              );
      
      console.log('🛠️ Converted measurement:', annotation);


    measurementService.addRawMeasurement(
      csToolsSource,
      'Length',
      { annotation }, 
      matchingMapping.toMeasurementSchema,
    );

    console.log('✅ Added measurement via addRawMeasurement');
    console.log(measurementService.getMeasurements());

      // Apply custom style AFTER it's added
      setTimeout(() => {
        annotationObj.config?.style?.setAnnotationStyles(annotationObj.annotationUID, { color });
      }, 100);
    });
  });
};



///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
///////////////  ,,,,,,,,,,,,,,  start again ,,,,,, Dec 17   //////////////////////
///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////




/**
 * Convert a DB annotation into a valid raw measurement
 * for MeasurementService.addRawMeasurement.
 */
export const annotationToRawMeasurement = (dbAnnotation, displaySetService) => {
  // Extract cached stats
  const cachedStats = dbAnnotation.data.cachedStats;
  const referencedImageId = Object.keys(cachedStats).find(key =>
      key.startsWith('imageId:')
);

  // Parse identifiers from imageId
  const {
    StudyInstanceUID,
    SeriesInstanceUID,
    SOPInstanceUID,
    frameNumber,
    strippedReferencedImageId,
  } = parseReferenceImageId(referencedImageId);

  // Measurement values
  const length = cachedStats[referencedImageId]?.length;
  const unit = cachedStats[referencedImageId]?.unit;

  // Geometry
  const handles = dbAnnotation.data.handles;
  const points = handles?.points ?? [];

  // DisplaySet linkage
  const displaySet = displaySetService.getDisplaySetForSOPInstanceUID(
    SOPInstanceUID,
    SeriesInstanceUID
  );

  return {
    // shape of object required for 'toMeasurementSchema' function
    uid: dbAnnotation.annotationUID, // required unique identifier
    SOPInstanceUID,
    FrameOfReferenceUID: dbAnnotation.metadata.FrameOfReferenceUID,
    isLocked: false,
    isVisible: true,
    metadata: {
      ...dbAnnotation.metadata,
      strippedReferencedImageId,
      toolName: 'Length',
    },

    referenceSeriesUID: SeriesInstanceUID,
    referenceStudyUID: StudyInstanceUID,
    referencedImageId: strippedReferencedImageId,
    frameNumber,
    displaySetInstanceUID: displaySet?.displaySetInstanceUID,

    type: 'value_type::polyline',
    label: dbAnnotation.data.label || 'Length',
    description: dbAnnotation.data.description || dbAnnotation.data.label,

    // Measurement-specific values go inside `data`
    data: {
      handles: { points },
      cachedStats: dbAnnotation.data.cachedStats, // contains measurement values
    },

  };
};


function parseReferenceImageId(referenceImageId: string) {
  // strip scheme
  const strippedReferencedImageId = referenceImageId.replace(/^imageId:/, '');
  const url = referenceImageId.replace(/^imageId:wadors:/, '');
  const u = new URL(url);

  const parts = u.pathname.split('/');

  const studyIndex = parts.indexOf('studies');
  const seriesIndex = parts.indexOf('series');
  const instancesIndex = parts.indexOf('instances');
  const framesIndex = parts.indexOf('frames');

  return {
    StudyInstanceUID: parts[studyIndex + 1],
    SeriesInstanceUID: parts[seriesIndex + 1],
    SOPInstanceUID: parts[instancesIndex + 1],
    frameNumber: Number(parts[framesIndex + 1]),
    strippedReferencedImageId,
  };
}

////////////  >>>>>>>>>>>>>>>>>>>  Shape of Measurement Object  <<<<<<<<<<<<<<<
///////////                     captured in handleMeasurementAdded
///////////              console.log(' *** IN MEASUREMENT ADD EVENT ... measurement', measurement);

// {
//     "uid": "b349c5cb-3bb6-419c-8e26-02f9773e6880",
//     "SOPInstanceUID": "1613192914.66227349772852536816607383583758607029",
//     "FrameOfReferenceUID": "1613192914.102990864631934508004100351763698922140",
//     "points": [
//         [
//             17.642687500000008,
//             89.33337499999996,
//             107.262
//         ],
//         [
//             73.85102083333332,
//             54.203166666666654,
//             107.262
//         ]
//     ],
//     "textBox": {
//         "hasMoved": false,
//         "worldPosition": [
//             73.8510208333333,
//             71.76827083333322,
//             107.262
//         ],
//         "worldBoundingBox": {
//             "topLeft": [
//                 134.1612628853564,
//                 132.0785128853563,
//                 107.262
//             ],
//             "topRight": [
//                 335.25822622757096,
//                 132.0785128853563,
//                 107.262
//             ],
//             "bottomLeft": [
//                 134.1612628853564,
//                 233.3997195327551,
//                 107.262
//             ],
//             "bottomRight": [
//                 335.25822622757096,
//                 233.3997195327551,
//                 107.262
//             ]
//         }
//     },
//     "isLocked": false,
//     "isVisible": true,
//     "metadata": {
//         "FrameOfReferenceUID": "1613192914.102990864631934508004100351763698922140",
//         "cameraFocalPoint": [
//             2.8880000000000052,
//             9.236500000000007,
//             107.262
//         ],
//         "viewPlaneNormal": [
//             0,
//             0,
//             -1
//         ],
//         "viewUp": [
//             0,
//             -1,
//             0
//         ],
//         "sliceIndex": 0,
//         "planeRestriction": {
//             "FrameOfReferenceUID": "1613192914.102990864631934508004100351763698922140",
//             "point": [
//                 17.642687500000008,
//                 89.33337499999996,
//                 107.262
//             ],
//             "inPlaneVector1": [
//                 0,
//                 -1,
//                 0
//             ],
//             "inPlaneVector2": {
//                 "0": 1,
//                 "1": 0,
//                 "2": 0
//             },
//             "planeRestriction": {
//                 "FrameOfReferenceUID": "1613192914.102990864631934508004100351763698922140",
//                 "point": [
//                     17.642687500000008,
//                     89.33337499999996,
//                     107.262
//                 ],
//                 "inPlaneVector1": null,
//                 "inPlaneVector2": null
//             }
//         },
//         "referencedImageId": "wadors:https://localhost/pacs/dicom-web/studies/1613192914.239053053316326170422028743544372735497/series/1613192914.261939891382043931045408808834153476298/instances/1613192914.66227349772852536816607383583758607029/frames/1",
//         "toolName": "Length",
//         "cameraPosition": [
//             2.8880000000000052,
//             9.236500000000007,
//             -157.49984335415303
//         ]
//     },
//     "referenceSeriesUID": "1613192914.261939891382043931045408808834153476298",
//     "referenceStudyUID": "1613192914.239053053316326170422028743544372735497",
//     "referencedImageId": "wadors:https://localhost/pacs/dicom-web/studies/1613192914.239053053316326170422028743544372735497/series/1613192914.261939891382043931045408808834153476298/instances/1613192914.66227349772852536816607383583758607029/frames/1",
//     "frameNumber": 1,
//     "toolName": "Length",
//     "displaySetInstanceUID": "ab4bf033-dfb2-8906-ce25-f166bf16c03b",
//     "label": "",
//     "displayText": {
//         "primary": [
//             "66.3 mm"
//         ],
//         "secondary": [
//             "S: 8 I: 1"
//         ]
//     },
//     "data": {
//         "imageId:wadors:https://localhost/pacs/dicom-web/studies/1613192914.239053053316326170422028743544372735497/series/1613192914.261939891382043931045408808834153476298/instances/1613192914.66227349772852536816607383583758607029/frames/1": {
//             "length": 66.28354451637684,
//             "unit": "mm"
//         }
//     },
//     "type": "value_type::polyline",
//     "source": {
//         "uid": "8f5894fa-f043-1905-0f47-59e15fc0f785",
//         "name": "Cornerstone3DTools",
//         "version": "0.1"
//     },
//     "modifiedTimestamp": 1766065868,
//     "isDirty": true,
//     "isSelected": true
// }
