// ModalComponent.tsx
import React from 'react';
import './ModalComponent.css';


type ModalProps = {
  title: string;
  message: string;
  onClose: () => void;
  showCancel?: boolean;
  onCancel?: () => void;
};

export const ModalComponent: React.FC<ModalProps> = ({
  title,
  message,
  onClose,
  showCancel = false,
  onCancel,
}) => (
  <div className="modal-overlay">
    <div className="modal-content">
      <h2 className="modal-title">{title}</h2>
      <p>{message}</p>
      <div className="modal-buttons">
        <button className="modal-button" onClick={onClose}>OK</button>
        {showCancel && (
          <button className="modal-button" onClick={onCancel ?? onClose}>Cancel</button>
        )}
      </div>
    </div>
  </div>
);