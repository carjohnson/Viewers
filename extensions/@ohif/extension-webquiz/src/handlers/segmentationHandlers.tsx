
import React, { useState } from 'react';

import { SegmentDetailsModal } from '../components/SegmentationList/SegmentDetailsModal';
import { computeSegmentDataIsComplete, saveSegmentation } from '../utils/segmentationUtils';
import { SegmentMetadata } from './../models/SegmentationData';
import { useSegmentMetadataStore } from '../stores/useSegmentMetadataStore';


//=========================================================
// Set up GUI so the user can click on a segment in the segmentation list

export const handleSegmentClick = ({
  segmentationId,
  segmentLabel,
  segmentArrayIndex,
  segmentIndex,
  showModal,
  closeModal,
  groundTruth,
  referenceStandardMethod,
  hepaticSegment,
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
    groundTruth: { value: number; label: string }[];
    referenceStandardMethod: { value: number; label: string }[];
    hepaticSegment: { value: number; label: string }[];
    servicesManager: any;
    commandsManager: any;
    segmentationService: any;
    activeViewportId: string;
    studyInstanceUID: string;
  }) => {

    let saveHandlerFromModal = null;

    showModal({
      title: "Segment Details",
      message: (
        <SegmentDetailsModal
          segmentationId={segmentationId}
          segmentLabel={segmentLabel}
          groundTruth={groundTruth}
          referenceStandardMethod={referenceStandardMethod}
          hepaticSegment={hepaticSegment}
          onSaveSegmentData={(saveFn) => {
            saveHandlerFromModal = saveFn;
          }}
        />
      ),
      confirmText: "Save",
      showCancel: true,
      onCancel: closeModal,
      onClose: () => {
        if (saveHandlerFromModal) {
          const dataFromModal = saveHandlerFromModal(); // reads fresh state
          console.log (' *** IN ONCLOSE ... segId, dataFromModal:', segmentationId, dataFromModal);

          const segmentMetadata: SegmentMetadata = {
            groundTruth: dataFromModal.groundTruth?.label ?? "",
            referenceStandardMethod: dataFromModal.referenceMethod?.label ?? "",
            hepaticSegment: dataFromModal.hepaticSegments ?? [],
            isComplete: false,
          };

          if (!segmentMetadata) {
            console.warn("Validation failed — keeping modal open");
            return;
          }


          segmentMetadata.isComplete = computeSegmentDataIsComplete(segmentMetadata);
          useSegmentMetadataStore.getState().setMetadata( segmentationId, segmentIndex, segmentMetadata);

          const storeForDebug = useSegmentMetadataStore.getState();
          console.log(' *** IN LOAD HANDLER ... segment metadata store:', storeForDebug);


          // get segmentation - update fields
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

          closeModal();
          return;
        }

        // If no save handler, just close normally
        closeModal();
      }

    });
  };

//=========================================================
