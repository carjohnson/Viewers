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
  isSeriesAnnotationsCompletedRef,
  showModal,
}: {
  uid: string;
  value: number;
  dropdownSelectionMap: Record<string, number>;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  triggerPost: (args: TriggerPostArgs) => void;
  annotation: any;
  isSeriesAnnotationsCompletedRef: React.MutableRefObject<boolean>;
  showModal: (modalProps: {
    title: string;
    message: string;
    showCancel?: boolean;
    onCancel?: () => void;
  }) => void;
}) => {
  const userInfo = getUserInfo();
  var sMsg = '';
  if (userInfo?.role === 'admin') { 
    sMsg = 'Admins are not allowed to modify annotations.';
  } else {
    if (isSeriesAnnotationsCompletedRef) { 
      sMsg = 'Changes not allowed for series marked as completed.';
    }
  }
  if (userInfo.role === 'admin' || isSeriesAnnotationsCompletedRef.current) {
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
