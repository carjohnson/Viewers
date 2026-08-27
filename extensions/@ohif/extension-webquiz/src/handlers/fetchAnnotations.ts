// src/handlers/fetchAnnotations.ts
import { buildDropdownSelectionMapFromFetched } from '../utils/annotationUtils';
import { notifyBackendError } from '../utils/notifyBackendError';
import { Enums as CSExtensionEnums } from '@ohif/extension-cornerstone';
import { annotation as csToolsAnnotation } from '@cornerstonejs/tools';
import { getRenderingEngines, RenderingEngine } from '@cornerstonejs/core';

//=========================================================
export const fetchAnnotationsFromDB = async ({
  userInfo,
  studyUID,
  baseUrl,
  setListOfUsersAnnotations,
  setDropdownSelectionMap,
  setAnnotationsLoaded,
  listOfUsersAnnotationsRef,
}: {
  userInfo: { username: string; role: string };
  studyUID: string;
  baseUrl: string;
  setListOfUsersAnnotations: (list: any[]) => void;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setAnnotationsLoaded: (loaded: boolean) => void;
  listOfUsersAnnotationsRef: React.MutableRefObject<Record<string, any> | null>;

}) => {
  const username = userInfo.role === 'reader' ? userInfo.username : 'all';

  try {
    const response = await fetch(
      `${baseUrl}/webquiz/list-users-annotations?username=${username}&studyUID=${studyUID}`,
      { credentials: 'include' }
    );
    
    const result = await response.json();
    if (response.status === 400 && result?.error === 'Study not found') {
      console.warn(`⚠️ Study document not found in DB for studyUID: ${studyUID} — it may have been deleted.`);
      throw new Error('Study not found in DB');
    }

    if (!response.ok) throw new Error('Failed to fetch annotations from DB');

    const { payload: annotationsList, legend } = result;

    setListOfUsersAnnotations(annotationsList);
    listOfUsersAnnotationsRef.current = annotationsList;

    const newMap = buildDropdownSelectionMapFromFetched(annotationsList);
    setDropdownSelectionMap(newMap);
    console.log(' *** IN FETCH ... studyUID, listRef, legend, newMap', studyUID, listOfUsersAnnotationsRef.current, legend, newMap);

    setAnnotationsLoaded(true);

    window.parent.postMessage({ type: 'update-legend', legend }, '*');
  } catch (error) {
    console.error('❌ Error fetching annotations:', error);
    // "Study not found" is expected/handled (e.g. study deleted), and an
    // unparseable response is most likely an auth-redirect timing issue -
    // neither is a "stop working, call the administrator" situation.
    // Only a genuine non-2xx server response or fetch() itself failing
    // outright (network/DB down) is worth surfacing that way.
    const isBenign =
      error instanceof Error &&
      (error.message === 'Study not found in DB' ||
        error.message === 'Unexpected response from server - you may need to log in again');
    if (!isBenign) {
      notifyBackendError(error instanceof Error ? error.message : String(error));
    }
  }
};


//=========================================================
export const convertAnnotationsToMeasurements = ({
  annotationsList,
  measurementService,
  displaySetService,
  onComplete,
  onError, 
}: {
  annotationsList: React.MutableRefObject<Record<string, any> | null>;
  measurementService: any;
  displaySetService: any;
  onComplete?: () => void;
  onError?: (error: string) => void;
}) => {
  try {
    const { 
      CORNERSTONE_3D_TOOLS_SOURCE_NAME,
      CORNERSTONE_3D_TOOLS_SOURCE_VERSION,
    } = CSExtensionEnums;

    const csToolsSource = measurementService.getSource(CORNERSTONE_3D_TOOLS_SOURCE_NAME, CORNERSTONE_3D_TOOLS_SOURCE_VERSION);
    if (!csToolsSource) {
      const error = 'CornerstoneTools source not found';
      console.error(error);
      onError?.(error);
      return;
    }

    const mappings = measurementService.getSourceMappings(CORNERSTONE_3D_TOOLS_SOURCE_NAME, CORNERSTONE_3D_TOOLS_SOURCE_VERSION);
    const matchingMapping = mappings.find(m => m.annotationType === "Length");

    const currentMeasurements = measurementService.getMeasurements();

    // Pre-filter: drop any annotation missing a UID up front, so every
    // entry we count in totalAnnotations is guaranteed to reach the
    // processedCount++ below. Keeps the loop and the completion check
    // in sync without special-casing invalid entries mid-loop.
    const validEntries = (annotationsList.current || []).map(userEntry => ({
      color: userEntry.color,
      data: (userEntry.data || []).filter((annotationObj: any) => {
        const isValid = !!annotationObj?.annotationUID;
        if (!isValid) {
          console.warn('⚠️ Skipping annotation with missing annotationUID:', annotationObj);
        }
        return isValid;
      }),
    }));

    let processedCount = 0;
    const totalAnnotations = validEntries.reduce(
      (sum, userEntry) => sum + userEntry.data.length,
      0
    );

    if (totalAnnotations === 0) {
      onComplete?.();
      return;
    }

    validEntries.forEach(({ data, color }) => {
      data.forEach((annotationObj: any) => {
        if (hasAnnotationInMeasurements(annotationObj, currentMeasurements)) {
          processedCount++;
          if (processedCount === totalAnnotations) {
            console.log('✅ All measurements converted and styled');
            getRenderingEngines()?.forEach(engine => engine.render());
            onComplete?.();
          }
          return;
        }

        const annotation = annotationToRawMeasurement(annotationObj, displaySetService);

        if (!annotation) {
          processedCount++;
          if (processedCount === totalAnnotations) {
            console.log('✅ All measurements converted and styled');
            getRenderingEngines()?.forEach(engine => engine.render());
            onComplete?.();
          }
          return;
        }

        const measurementUID = measurementService.addRawMeasurement(
          csToolsSource,
          'Length',
          { annotation }, 
          matchingMapping.toMeasurementSchema,
        );

        const registered = csToolsAnnotation.state.getAnnotation(measurementUID);
        console.log('🔎 UID', measurementUID, '— found in CS3D state?', !!registered, registered);


        csToolsAnnotation.config.style.setAnnotationStyles(measurementUID, { color });

        processedCount++;
        if (processedCount === totalAnnotations) {
          console.log('✅ All measurements converted and styled');
          getRenderingEngines()?.forEach(engine => engine.render());
          onComplete?.();
        }

      });
    });

  } catch (error) {
    console.error('❌ convertAnnotationsToMeasurements failed:', error);
    onError?.(error as string);
  }
};




//=========================================================
/**
 * Convert a DB annotation into a valid raw measurement
 * for MeasurementService.addRawMeasurement.
 *
 * Returns `null` (instead of `undefined`, and instead of throwing) for any
 * annotation that can't be converted, so callers can reliably filter/skip
 * bad annotations rather than passing `undefined` downstream.
 */
export const annotationToRawMeasurement = (dbAnnotation, displaySetService) => {
  const annotationUID = dbAnnotation?.annotationUID ?? '(unknown UID)';

  // Extract cached stats.
  // Stack-viewport annotations key cachedStats by 'imageId:wadors:...' — one
  // entry, directly parseable.
  // Volume-viewport (MPR) annotations instead key cachedStats by
  // 'volumeId:cornerstoneStreamingImageVolume:<uuid>?sliceIndex=...', which
  // has no parseable Study/Series/SOPInstanceUID in it at all. For those, we
  // fall back to metadata.referencedImageId, which OHIF populates regardless
  // of viewport type.
  const cachedStats = dbAnnotation.data.cachedStats;
  let referencedImageId = cachedStats
    ? Object.keys(cachedStats).find(key => key.startsWith('imageId:'))
    : undefined;

  let usedFallback = false;
  if (!referencedImageId) {
    referencedImageId = dbAnnotation.metadata?.referencedImageId;
    usedFallback = true;
  }

  if (!referencedImageId) {
    console.warn(
      `Skipping annotation ${annotationUID}: no 'imageId:' key found in cachedStats, and no metadata.referencedImageId fallback available`,
      cachedStats
    );
    return null;
  }

  // Parse identifiers from imageId
  const parsed = parseReferenceImageId(referencedImageId);
  if (!parsed) {
    console.warn(
      `Skipping annotation ${annotationUID}: could not parse referencedImageId "${referencedImageId}"`
    );
    return null;
  }

  const {
    StudyInstanceUID,
    SeriesInstanceUID,
    SOPInstanceUID,
    frameNumber,
    strippedReferencedImageId,
  } = parsed;

  // console.log(' *** IN ANN TO RAW ... SOPInstance, StudyUID, SeriesUID:', SOPInstanceUID, StudyInstanceUID, SeriesInstanceUID, displaySetService);

  // Geometry
  const handles = dbAnnotation.data.handles;
  const points = handles?.points ?? [];

  const lDisplaySets = displaySetService.getDisplaySetsForSeries(SeriesInstanceUID);
  // console.log(' *** IN ANN TO RAW ... displaySets', lDisplaySets);
  // DisplaySet linkage
  const displaySet = displaySetService.getDisplaySetForSOPInstanceUID(
    SOPInstanceUID,
    SeriesInstanceUID
  );

  if (!displaySet) {
    console.warn(
      `Skipping annotation ${annotationUID}: no valid displaySet for SOPInstanceUID=${SOPInstanceUID}, SeriesInstanceUID=${SeriesInstanceUID}`
    );
    return null;
  }

  if (!dbAnnotation.metadata) {
    console.warn(
      `Skipping annotation ${annotationUID}: missing metadata (no FrameOfReferenceUID available)`
    );
    return null;
  }

  return {
    // shape of object required for 'toMeasurementSchema' function.
    // NOTE: `uid` here is NOT preserved — measurementService/CS3D always
    // generates its own annotation UID internally, regardless of what's
    // passed here. Confirmed empirically: setting this to dbAnnotation's
    // original annotationUID had no effect on the UID actually registered
    // in Cornerstone3D state. Kept only because the shape appears to
    // require the key; do not rely on this value downstream.
    uid: dbAnnotation.annotationUID,
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
    description: dbAnnotation.data.description || dbAnnotation.data.label,

    // Measurement-specific values go inside `data`
    data: {
      handles: { points },
      label: dbAnnotation.data.label || 'Length',
      suspicionScore: dbAnnotation.data.suspicionScore, //custom field for display of scores
      cachedStats: dbAnnotation.data.cachedStats, // contains measurement values
    },

  };
};

//=========================================================
function parseReferenceImageId(referenceImageId: string) {
  if (!referenceImageId) {
    return null;
  }

  // Normalize the *input* so all observed source shapes are accepted:
  //  - from cachedStats:                    'imageId:wadors:https://...'
  //  - from metadata.referencedImageId:     'wadors:https://...'
  //  - from metadata.referencedImageId:     'https://...' (no scheme prefix at all)
  // Strip any 'imageId:' and/or 'wadors:' prefixes first, then rebuild the
  // canonical 'imageId:wadors:https://...' form. This guarantees
  // strippedReferencedImageId (stored back on the new measurement's
  // metadata) always comes out as 'wadors:https://...', matching the
  // original stack-viewport shape, regardless of which prefix shape we
  // started with.
  const bareUrl = referenceImageId
    .replace(/^imageId:/, '')
    .replace(/^wadors:/, '');
  const strippedReferencedImageId = `wadors:${bareUrl}`;
  const url = bareUrl;

  let u: URL;
  try {
    u = new URL(url);
  } catch (err) {
    console.warn(`parseReferenceImageId: invalid URL "${url}"`, err);
    return null;
  }

  const parts = u.pathname.split('/');

  const studyIndex = parts.indexOf('studies');
  const seriesIndex = parts.indexOf('series');
  const instancesIndex = parts.indexOf('instances');
  const framesIndex = parts.indexOf('frames');

  if (studyIndex === -1 || seriesIndex === -1 || instancesIndex === -1) {
    console.warn(
      `parseReferenceImageId: URL is missing expected path segments (studies/series/instances): "${u.pathname}"`
    );
    return null;
  }

  return {
    StudyInstanceUID: parts[studyIndex + 1],
    SeriesInstanceUID: parts[seriesIndex + 1],
    SOPInstanceUID: parts[instancesIndex + 1],
    frameNumber: framesIndex !== -1 ? Number(parts[framesIndex + 1]) : undefined,
    strippedReferencedImageId,
  };
}

//=========================================================
// function to check if the annotation fetched from the database
//    matches any of the measurements currently loaded 
//    NOTE: label has username embedded as a prefix 
//          which will distinguish an annotation on same image, same tool by different users
function hasAnnotationInMeasurements(fetchedAnnotation, currentMeasurements) {
  if (!currentMeasurements?.length) return null;

  const { metadata, data } = fetchedAnnotation;
  const fetchedPoints = data?.handles?.points;
  const fetchedImageId = metadata?.referencedImageId;
  const fetchedTool = metadata?.toolName;
  const fetchedLabel = data?.label;

  return currentMeasurements.find(meas => {
    const sameImage = meas.referencedImageId === fetchedImageId;
    const sameTool = meas.toolName === fetchedTool;

    const measPoints =
      meas.points ||
      meas.data?.handles?.points ||
      meas.data?.points;

    // NOTE: Geometry may change when collapsed
    // const sameGeometry =
    //   JSON.stringify(measPoints) === JSON.stringify(fetchedPoints);

    const sameLabel = 
      meas.label === fetchedLabel;

    if (sameImage && sameTool && sameLabel) return true;
  }) || false;
}

//=========================================================


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
