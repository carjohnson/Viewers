// src/handlers/dropdownHandlers.ts

import { setUserInfo, getUserInfo } from './../../../../../modes/@ohif/mode-webquiz/src/userInfoService';
import { TriggerPostArgs } from '../models/TriggerPostArgs';

export const handleDropdownChange = ({
  uid,
  value,
  dropdownSelectionMap,
  setDropdownSelectionMap,
  triggerPost,
  annotation,
  isStudyCompletedRef,
  showModal,
}: {
  uid: string;
  value: number;
  dropdownSelectionMap: Record<string, number>;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  triggerPost: (args: TriggerPostArgs) => void;
  annotation: any;
  isStudyCompletedRef: React.MutableRefObject<boolean>;
  showModal: (modalProps: {
    title: string;
    message: string;
    showCancel?: boolean;
    onCancel?: () => void;
  }) => void;
}) => {
  const userInfo = getUserInfo();
  // console.log(' *** IN DROPDOWN CHANGE HANDLER', isStudyCompletedRef);
  var sMsg = '';
  if (userInfo?.role === 'admin') { 
    sMsg = 'Admins are not allowed to modify annotations.';
  } else {
    if (isStudyCompletedRef.current) { 
      sMsg = 'Changes not allowed for cases marked as completed.';
    }
  }
  if (userInfo.role === 'admin' || isStudyCompletedRef.current) {
    showModal({
      title: 'Score Changes Blocked',
      message: sMsg,
      showCancel: false,
    });
    return;
  } else {
    const updatedMap = { ...dropdownSelectionMap, [uid]: value };
    setDropdownSelectionMap(updatedMap);

    triggerPost({
      allAnnotations: annotation.state.getAllAnnotations(),
      dropdownSelectionMap: updatedMap,
    });
  }
};
