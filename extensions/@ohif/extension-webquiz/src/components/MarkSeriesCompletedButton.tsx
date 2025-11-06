import React from 'react';
import { Button } from '@ohif/ui'; // or your preferred button source
import { postStudyProgress } from '../handlers/studyProgressHandlers';
import {UserInfo} from '../models/UserInfo'

type Props = {
  baseUrl: string;
  getUserInfo: () => UserInfo | null;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  completed: boolean;
  setCompleted: (value:boolean) => void;
  onMarkCompleted?: (studyUID: string, seriesUID: string) => void;
};

const MarkSeriesCompletedButton: React.FC<Props> = ({
  baseUrl,
  getUserInfo,
  studyInstanceUID,
  seriesInstanceUID,
  completed,
  setCompleted,
  onMarkCompleted,
}) => {
  const handleClick = async() => {
    console.log(`📬 Marking study ${studyInstanceUID} and series ${seriesInstanceUID} as completed`);
    if (onMarkCompleted) {
      onMarkCompleted(studyInstanceUID, seriesInstanceUID);
    }
    setCompleted(true);

    const userInfo = getUserInfo();
    
    const progressResult = await postStudyProgress({
        baseUrl,
        username: userInfo.username,
        studyUID: studyInstanceUID,
        seriesUID: seriesInstanceUID,
        status: 'done',
    });

    if (progressResult?.error) {
        console.warn('⚠️ Failed to post progress:', progressResult.error);
    } else {
        console.log(`📌 Progress posted for ${seriesInstanceUID}`);
    }


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