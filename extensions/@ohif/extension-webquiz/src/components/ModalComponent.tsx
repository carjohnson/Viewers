// ModalComponent.tsx
import React from 'react';
import './ModalComponent.css';

export const ModalComponent = ({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">{title}</h2>
        <p>{message}</p>
        <button className="modal-button" onClick={onClose}>OK</button>
      </div>
    </div>
  );
};