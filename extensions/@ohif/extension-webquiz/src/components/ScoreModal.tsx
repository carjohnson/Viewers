import React from 'react';
import Modal from 'react-modal';
import Select from 'react-select';
import styles from './ScoreModal.module.css';
import { customizeAnnotationLabel, rebuildMapAndPostAnnotations } from './../utils/annotationUtils';
import { TriggerPostArgs } from '../models/TriggerPostArgs';


type ScoreOption = {
  value: number;
  label: string;
};


type Props = {
  isOpen: boolean;
  scoreOptions: { value: number; label: string }[];
  selectedScore: number | null;
  setSelectedScore: (score: number | null) => void;
  onClose: (uid: string) => void;
  pendingAnnotationUIDRef: React.MutableRefObject<string | null>;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>
  triggerPost: (args: TriggerPostArgs) => void;
  isStudyCompleted: boolean;
};

export const ScoreModal = ({
  isOpen,
  scoreOptions,
  selectedScore,
  setSelectedScore,
  onClose,
  pendingAnnotationUIDRef,
  setDropdownSelectionMap,
  triggerPost,
  isStudyCompleted,
}: Props) => {

  const uid = pendingAnnotationUIDRef.current;

  const handleOkClick = () => {
    if (!uid) return;
    customizeAnnotationLabel(uid);
    onClose(uid);
    rebuildMapAndPostAnnotations(setDropdownSelectionMap, triggerPost);
    pendingAnnotationUIDRef.current = null;
  };

  const handleCancel = () => {
    pendingAnnotationUIDRef.current = null;
    onClose("");   // close without saving
  };

  return (
    <Modal
      isOpen={isOpen}
      className={styles.scoreModal}
      overlayClassName={styles.scoreModalOverlay}
      shouldCloseOnOverlayClick={false}
      shouldCloseOnEsc={false}
    >
      <h3>Select Suspicion Score</h3>

      {isStudyCompleted && (
        <div style={{ marginBottom: "1rem", color: "red", fontWeight: 600 }}>
          Changes disabled — study marked as complete
        </div>
      )}

      <Select<ScoreOption>
        options={scoreOptions}
        value={scoreOptions.find(opt => opt.value === selectedScore) ?? null}
        onChange={(option) => setSelectedScore(option?.value ?? null)}
        isDisabled={isStudyCompleted}
      />

      <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
        <button
          className={styles.okButton}
          style={{
            padding: "8px 16px",
            backgroundColor: isStudyCompleted ? "#999" : "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "4px"
          }}
          disabled={isStudyCompleted || selectedScore === null}
          onClick={() => {
            if (isStudyCompleted) return;
            handleOkClick();
          }}
        >
          OK
        </button>

        {isStudyCompleted && (
          <button
            style={{
              padding: "8px 16px",
              backgroundColor: "#666",
              color: "#fff",
              border: "none",
              borderRadius: "4px"
            }}
            onClick={handleCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </Modal>
  );
};
