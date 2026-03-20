
import React, { useState } from 'react';

import { SegmentDetailsModal } from '../components/SegmentationList/SegmentDetailsModal'


//=========================================================
// Set up GUI so the user can click on an annotation in the panel list
//    and have the image jump to the corresponding slice
//    also - set up a visibility icon for each annotation

export const handleSegmentClick = ({
  segmentationId,
  segmentLabel,
  showModal,
  closeModal,
  groundTruth,
  referenceStandardMethod,
  hepaticSegment,
  setCompletedSegments,
}: {
  segmentationId: string;
  segmentLabel: string;
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
          const data = saveHandlerFromModal(); // reads fresh state

          if (!data) {
            console.warn("Validation failed — keeping modal open");
            return;
          }

          console.log("Saving segment data:", data);

          // Mark this segment as completed
          setCompletedSegments(prev => ({
            ...prev,
            [segmentLabel]: true
          }));

          // TODO: save to backend

          closeModal();
          return;
        }

        // If no save handler, just close normally
        closeModal();
      }

    });
  };

//=========================================================
