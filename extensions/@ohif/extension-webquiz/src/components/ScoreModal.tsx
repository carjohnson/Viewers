import React from 'react';
import Modal from 'react-modal';
import Select from 'react-select';
import styles from './ScoreModal.module.css';

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
};

export const ScoreModal = ({
  isOpen,
  scoreOptions,
  selectedScore,
  setSelectedScore,
  onClose,
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
                console.log('✅ OK button clicked');
                onClose() }}
        >
            OK
        </button>
    </Modal>
  )};