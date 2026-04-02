
import React, { useState } from 'react';

import { SegmentDetailsModal } from '../components/SegmentationList/SegmentDetailsModal';
import { computeSegmentDataIsComplete, saveSegmentation } from '../utils/segmentationUtils';
import { SegmentMetadata } from './../models/SegmentationData';
import { useSegmentMetadataStore } from '../stores/useSegmentMetadataStore';
import { segmentation as csSegmentation, Enums as csToolsEnums,  } from '@cornerstonejs/tools';

//=========================================================
// Set up GUI so the user can click on a segment in the segmentation list

export const handleSegmentClick = ({
  segmentationId,
  segmentLabel,
  segmentArrayIndex,
  segmentIndex,
  showModal,
  closeModal,
  groundTruthOptions,
  referenceStandardMethodOptions,
  hepaticSegmentOptions,
  servicesManager,
  commandsManager,
  segmentationService,
  activeViewportId,
  studyInstanceUID,
}: {
  segmentationId: string;
  segmentLabel: string;
  segmentArrayIndex: number;
  segmentIndex: number
  showModal: (args: {
        title: string;
        message: React.ReactNode;
        onClose?: () => void;
        showCancel?: boolean;
        onCancel?: () => void;
        confirmText: string;
    }) => void;
    closeModal: () => void;
    groundTruthOptions: { value: number; label: string }[];
    referenceStandardMethodOptions: { value: number; label: string }[];
    hepaticSegmentOptions: { value: number; label: string }[];
    servicesManager: any;
    commandsManager: any;
    segmentationService: any;
    activeViewportId: string;
    studyInstanceUID: string;
  }) => {

    let saveHandlerFromModal = null;
    const metadata = useSegmentMetadataStore.getState().getMetadata(segmentationId, segmentIndex);

    showModal({
      title: "Segment Details",
      message: (
        <SegmentDetailsModal
          segmentationId={segmentationId}
          segmentLabel={segmentLabel}
          groundTruthOptions={groundTruthOptions}
          referenceMethodOptions={referenceStandardMethodOptions}
          hepaticSegmentOptions={hepaticSegmentOptions}
          selectedGroundTruth={metadata?.groundTruth ?? ""}
          selectedReferenceMethod={metadata?.referenceStandardMethod ?? ""}
          selectedHepaticSegments={metadata?.hepaticSegment ?? []}
          onSaveSegmentData={(saveFn) => {
            saveHandlerFromModal = saveFn;
          }}
        />
      ),
      confirmText: "Save",
      showCancel: true,
      onCancel: closeModal,
      // onClose: () => {
      //   if (saveHandlerFromModal) {
      //     const dataFromModal = saveHandlerFromModal(); // reads fresh state
      //     console.log (' *** IN ONCLOSE ... segId, dataFromModal:', segmentationId, dataFromModal);

      //     const segmentMetadata: SegmentMetadata = {
      //       groundTruth: dataFromModal.groundTruth?.label ?? "",
      //       referenceStandardMethod: dataFromModal.referenceMethod?.label ?? "",
      //       hepaticSegment: dataFromModal.hepaticSegments ?? [],
      //       isComplete: false,
      //     };

      //     if (segmentMetadata.groundTruth === "" || segmentMetadata.referenceStandardMethod === "" || segmentMetadata.hepaticSegment.length === 0) {
      //       console.warn("Validation failed — keeping modal open");
      //       return;
      //     }


      //     segmentMetadata.isComplete = computeSegmentDataIsComplete(segmentMetadata);
      //     useSegmentMetadataStore.getState().setMetadata( segmentationId, segmentIndex, segmentMetadata);
      //       segmentationService.triggerSegmentationEvents.triggerSegmentationRepresentationModified(
      //         activeViewportId,
      //         segmentationId,
      //         'LABELMAP'
      //       );

      //     const storeForDebug = useSegmentMetadataStore.getState();
      //     console.log(' *** IN LOAD HANDLER ... segment metadata store:', storeForDebug);


      //     // get segmentation - update fields
      //     const segmentationToUpdate = segmentationService.getSegmentation(segmentationId);
      //     saveSegmentation({
      //       seg: segmentationToUpdate,
      //       segmentArrayIndex,
      //       segmentIndex,
      //       segmentMetadata,
      //       activeViewportId,
      //       servicesManager,
      //       commandsManager,
      //       studyInstanceUID,
      //   });

      //     closeModal();
      //     return;
      //   }

      //   // If no save handler, just close normally
      //   closeModal();
      // }

      onClose: () => {
        try {
          if (saveHandlerFromModal) {
            const dataFromModal = saveHandlerFromModal(); // reads fresh state
            console.log('*** IN ONCLOSE ... segId, dataFromModal:', segmentationId, dataFromModal);

            if (!dataFromModal) {
              console.warn("Modal returned null — validation failed or Save was blocked.");
              return;
            }

            const segmentMetadata: SegmentMetadata = {
              groundTruth: dataFromModal.groundTruth?.label ?? "",
              referenceStandardMethod: dataFromModal.referenceMethod?.label ?? "",
              hepaticSegment: dataFromModal.hepaticSegments ?? [],
              isComplete: false,
            };

            if (
              segmentMetadata.groundTruth === "" ||
              segmentMetadata.referenceStandardMethod === "" ||
              segmentMetadata.hepaticSegment.length === 0
            ) {
              console.warn("Validation failed — keeping modal open");
              return;
            }

            segmentMetadata.isComplete = computeSegmentDataIsComplete(segmentMetadata);

            // Update your metadata store
            useSegmentMetadataStore
              .getState()
              .setMetadata(segmentationId, segmentIndex, segmentMetadata);


                      // // 🔥 Force OHIF segmentation panel to refresh
                      //   const seg = segmentationService.getSegmentation(segmentationId);
                      // segmentationService.addOrUpdateSegmentation({segmentationId, seg});

                      //   console.group("🔎 Cornerstone Segmentation Debug");
                      //   console.log("csSegmentation:", csSegmentation);
                      //   console.log("csSegmentation keys:", Object.keys(csSegmentation));

                      //   console.log("triggerSegmentationEvents:", csSegmentation.triggerSegmentationEvents);
                      //   if (csSegmentation.triggerSegmentationEvents) {
                      //     console.log(
                      //       "triggerSegmentationEvents keys:",
                      //       Object.keys(csSegmentation.triggerSegmentationEvents)
                      //     );
                      //   }

                      //   // console.log("EVENTS:", csSegmentation.EVENTS);
                      //   console.groupEnd();

                        // console.group("🔎 OHIF SegmentationService Debug");
                        // console.log("segmentationService:", segmentationService);
                        // console.log("segmentationService keys:", Object.keys(segmentationService));

                        // console.log("segmentationService.EVENTS:", segmentationService.EVENTS);
                        // console.log("segmentationService.subscribe:", segmentationService.subscribe);

                        // // more debugging - set up a listener that will log the arguments
                        // const sub = segmentationService.subscribe(
                        //   segmentationService.EVENTS.SEGMENTATION_MODIFIED,
                        //   (...args) => console.log("🔥 SEGMENTATION_MODIFIED fired!", args)
                        // );
                        // console.log("Subscription object:", sub);

                        // console.groupEnd();

                      //   // 🔥 NEW: Force OHIF to refresh segmentation UI
                      //   // segmentationService._broadcastEvent(
                      //   //   segmentationService.EVENTS.SEGMENTATION_MODIFIED,
                      //   //   { segmentationId }
                      //   // );
                      //   csSegmentation.triggerSegmentationEvents.triggerSegmentationModified(segmentationId);
                      //   //// OR ////
                      //   csSegmentation.triggerSegmentationEvents.triggerSegmentationRepresentationModified(
                      //     activeViewportId,
                      //     segmentationId,
                      //     csToolsEnums.SegmentationRepresentations.Labelmap
                      //   );


            const storeForDebug = useSegmentMetadataStore.getState();
            console.log('*** IN LOAD HANDLER ... segment metadata store:', storeForDebug);

            // Update segmentation in cornerstone + backend
            const segmentationToUpdate = segmentationService.getSegmentation(segmentationId);
            saveSegmentation({
              seg: segmentationToUpdate,
              segmentArrayIndex,
              segmentIndex,
              segmentMetadata,
              activeViewportId,
              servicesManager,
              commandsManager,
              studyInstanceUID,
            });


            const storeForDebugAfterSave = useSegmentMetadataStore.getState();
            console.log('*** IN LOAD HANDLER After Save... segment metadata store:', storeForDebugAfterSave);

            closeModal();
            return;
          }

          // If no save handler, just close normally
          closeModal();
        } catch (err) {
          console.error("🔥 ERROR IN onClose:", err);
          console.error("Stack trace:", err?.stack);
        }
      }



    });
  };

//=========================================================
