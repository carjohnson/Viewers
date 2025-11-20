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
  onClose: () => void;
  pendingAnnotationUIDRef: React.MutableRefObject<string | null>;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>
  triggerPost: (args: TriggerPostArgs) => void;
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
}: Props) => {
  return (
    <Modal
        isOpen={isOpen}
        className={styles.scoreModal}
        overlayClassName={styles.scoreModalOverlay}
        shouldCloseOnOverlayClick={false} // disables clicking outside to close
        shouldCloseOnEsc={false}          // disables ESC key
        >
        <h3>Select Suspicion Score</h3>
        <Select<ScoreOption>
            options={scoreOptions}
            value={scoreOptions.find(opt => opt.value === selectedScore) ?? null}
            onChange={(option) => setSelectedScore(option?.value ?? null)}
        />

        <button
            style={{ padding: '8px 16px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px' }}
            disabled={selectedScore === null}
            onClick={() => { 
                console.log('✅ OK button clicked', pendingAnnotationUIDRef.current);
                const uid = pendingAnnotationUIDRef.current;
                if (!uid) return;
                customizeAnnotationLabel(uid);
                onClose(); //closing modal will set suspicionScore
                rebuildMapAndPostAnnotations(setDropdownSelectionMap, triggerPost);
                pendingAnnotationUIDRef.current = null;
                }}
        >
            OK
        </button>
    </Modal>
  )};