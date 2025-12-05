import React from 'react';
import { Button } from '@ohif/ui'; // or your preferred button source
import { postStudyProgressComplete } from '../handlers/studyProgressHandlers';
import {UserInfo} from '../models/UserInfo'

type Props = {
  baseUrl: string;
  getUserInfo: () => UserInfo | null;
  studyInstanceUID: string;
  isStudyCompleted: boolean;
  setStudyCompleted: (value:boolean) => void;
  isStudyCompletedRef: React.MutableRefObject<boolean>;
  onMarkCompleted?: (studyInstanceUID: string) => void;
  showModal: (args: {
    title: string;
    message: string;
    onClose?: () => void;
    showCancel?: boolean;
    onCancel?: () => void;
  }) => void;
  closeModal: () => void;
};

const MarkStudyCompletedButton: React.FC<Props> = ({
  baseUrl,
  getUserInfo,
  studyInstanceUID,
  isStudyCompleted,
  setStudyCompleted,
  isStudyCompletedRef,
  onMarkCompleted,
  showModal,
  closeModal,
}) => {
  const handleClick = () => {



      showModal({
        title: 'Confirm Completion',
        message: 'Are you sure? No further adjustments can be made.',
        showCancel: true,
        onCancel: () => {
          console.log('❌ Cancelled marking case as completed');
          closeModal();
        },
        onClose: confirmCompletion,
      });
    
  };


  const confirmCompletion = async () => {

    
    setStudyCompleted(true);
    if (isStudyCompletedRef) {
      isStudyCompletedRef.current = true;
    }

    console.log(`📬 Marking study ${studyInstanceUID} as completed`);
    if (onMarkCompleted) {
      onMarkCompleted(studyInstanceUID);
    }    

    const userInfo = getUserInfo();
    const progressResult = await postStudyProgressComplete({
      baseUrl,
      username: userInfo.username,
      studyUID: studyInstanceUID,
    });

    if (progressResult?.error) {
      console.warn('⚠️ Failed to post progress:', progressResult.error);
    } else {
      console.log(`📌 Progress posted for ${studyInstanceUID}`);
    }

    closeModal();

  };  

  return (
    <div className="p-2 text-center">
    {getUserInfo()?.role !== 'admin' && (
        <Button
        onClick={handleClick}
        disabled={isStudyCompleted || getUserInfo()?.role === 'admin'}
        className="bg-green-600 hover:bg-green-700 text-white font-semibold rounded px-4 py-2"
        >
        {isStudyCompleted ? '✅ Case Completed' : 'Mark Case Completed'}
        </Button>
    )}
    </div>
  );
};

export default MarkStudyCompletedButton;
