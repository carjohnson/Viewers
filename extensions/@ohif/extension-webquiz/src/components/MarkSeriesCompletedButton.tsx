import React from 'react';
import { Button } from '@ohif/ui'; // or your preferred button source

type Props = {
  studyInstanceUID: string;
  seriesInstanceUID: string;
  completed: boolean;
  setCompleted: (value:boolean) => void;
  onMarkCompleted?: (studyUID: string, seriesUID: string) => void;
};

const MarkSeriesCompletedButton: React.FC<Props> = ({
  studyInstanceUID,
  seriesInstanceUID,
  completed,
  setCompleted,
  onMarkCompleted,
}) => {
  const handleClick = () => {
    console.log(`📬 Marking study ${studyInstanceUID} and series ${seriesInstanceUID} as completed`);
    if (onMarkCompleted) {
      onMarkCompleted(studyInstanceUID, seriesInstanceUID);
    }
    setCompleted(true);
    // TODO: Replace with actual POST to backend
  };

  return (
    <div className="p-2 text-center">
      <Button
        // type="primary"
        onClick={handleClick}
        disabled={completed}
        className="bg-green-600 hover:bg-green-700 text-white font-semibold rounded px-4 py-2"
      >
        {completed ? '✅ Annotations Completed' : 'Mark Series Annotations Completed'}
      </Button>
    </div>
  );
};

export default MarkSeriesCompletedButton;