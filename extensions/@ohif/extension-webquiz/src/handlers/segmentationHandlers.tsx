
import React, { useState } from 'react';

import { SegmentDetailsModal } from '../components/SegmentationList/SegmentDetailsModal';
import { saveSegmentation } from '../utils/segmentationUtils';
import { SegmentMetadata } from './../models/SegmentationData';


//=========================================================
// Set up GUI so the user can click on an annotation in the panel list
//    and have the image jump to the corresponding slice
//    also - set up a visibility icon for each annotation

export const handleSegmentClick = ({
  segmentationId,
  segmentLabel,
  segmentArrayIndex,
  showModal,
  closeModal,
  groundTruth,
  referenceStandardMethod,
  hepaticSegment,
  setCompletedSegments,
  servicesManager,
  commandsManager,
  segmentationService,
  activeViewportId,
  studyInstanceUID,
}: {
  segmentationId: string;
  segmentLabel: string;
  segmentArrayIndex: number;
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
    setCompletedSegments: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
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
          };

          if (!segmentMetadata) {
            console.warn("Validation failed — keeping modal open");
            return;
          }

          // Mark this segment as completed
          setCompletedSegments(prev => ({
            ...prev,
            [segmentLabel]: true
          }));

          // get segmentation - update fields
          const segmentationToUpdate = segmentationService.getSegmentation(segmentationId);
          saveSegmentation({
            seg: segmentationToUpdate,
            segmentArrayIndex,
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
