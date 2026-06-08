
import React, { useState } from 'react';

import { SegmentDetailsModal } from '../components/SegmentationList/SegmentDetailsModal';
import { computeSegmentDataIsComplete, saveSegmentation } from '../utils/segmentationUtils';
import { SegmentMetadata, SegmentRecord } from './../models/SegmentationData';
import { useSegmentMetadataStore } from '../stores/useSegmentMetadataStore';

//=========================================================
// Set up GUI so the user can click on a segment in the segmentation list

export const handleSegmentClick = ({
  segmentationId,
  segmentationLabel,
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
  segmentationLabel: string;
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
    const metadata = useSegmentMetadataStore.getState().getSegmentInfo(segmentationId, segmentIndex).quizSegmentMetadata;

    showModal({
      title: "Segment Details",
      message: (
        <SegmentDetailsModal
          segmentationId={segmentationId}
          segmentationLabel={segmentationLabel}
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
      onClose: () => {
        try {
          if (saveHandlerFromModal) {
            const dataFromModal = saveHandlerFromModal(); // reads fresh state
            // console.log('*** IN ONCLOSE ... segId, dataFromModal:', segmentationId, dataFromModal);

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

                  // FOR DEBUG
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
                        // const storeForDebug = useSegmentMetadataStore.getState();
                        // console.log('*** IN LOAD HANDLER ... segment metadata store:', storeForDebug);



            // Update segmentation in cornerstone + backend
             const segmentationToUpdate = segmentationService.getSegmentation(segmentationId);

            // get current state of segment in metadata store
            const currentStoreSegment = useSegmentMetadataStore.getState().getSegmentInfo(segmentationToUpdate.segmentationId, segmentIndex);

            // Update metadata store as modal closes
            const segmentToUpdate = segmentationToUpdate?.segments?.[segmentIndex];

            if (!segmentToUpdate) {
              console.warn(
                `No segment found for segmentationId=${segmentationId}, segmentIndex=${segmentIndex}, segmentArrayIndex=${segmentArrayIndex}`
              );
              closeModal();
              return;
            }

            const segmentRecord: SegmentRecord = {
              segmentIndex,   // matches backend schema - mask value
              label: segmentLabel,
              cachedStats: segmentToUpdate.cachedStats,
              quizSegmentMetadata: {
                groundTruth: segmentMetadata.groundTruth,
                referenceStandardMethod: segmentMetadata.referenceStandardMethod,
                hepaticSegment: segmentMetadata.hepaticSegment,
                isComplete: segmentMetadata.isComplete,
                dicomSegMaskValue: currentStoreSegment?.quizSegmentMetadata?.dicomSegMaskValue,
              }
            };

            useSegmentMetadataStore.getState().setSegmentInfo( segmentationId, segmentIndex, segmentRecord );

  // //////////////////////////////
  // //////////////////////////////
  // // for debug
  // const allSegmentations = segmentationService.getSegmentations();
  // Object.values(allSegmentations).forEach(segmentation => {
  //   const segId = segmentation.segmentationId;
  //   const serviceKeys = Object.keys(segmentation?.segments || {});

  //   const storeState = useSegmentMetadataStore.getState();
  //   const storeSegments = storeState.getAllSegments(segId) || {};

  //   console.log('📊 in HandleClick store keys:', Object.keys(storeSegments), `segmentation ${segId}`);
  //   console.log('📊 in HandleClick service keys:', serviceKeys, `segmentation ${segId}`);

  // });
  // //////////////////////////////
  // //////////////////////////////


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


            // const storeForDebugAfterSave = useSegmentMetadataStore.getState();
            // console.log('*** IN LOAD HANDLER After Save... segment metadata store:', storeForDebugAfterSave);

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
