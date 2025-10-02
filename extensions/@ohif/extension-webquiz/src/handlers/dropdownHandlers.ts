// src/handlers/dropdownHandlers.ts

import { setUserInfo, getUserInfo } from './../../../../../modes/@ohif/mode-webquiz/src/userInfoService';
import { TriggerPostArgs } from '../models/TriggerPostArgs';

export const handleDropdownChange = ({
  uid,
  value,
  dropdownSelectionMap,
  setDropdownSelectionMap,
  triggerPost,
  pendingAlertUIDsRef,
  annotation,
}: {
  uid: string;
  value: number;
  dropdownSelectionMap: Record<string, number>;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  triggerPost: (args: TriggerPostArgs) => void;
  pendingAlertUIDsRef: React.RefObject<string[]>;
  annotation: any;
}) => {
  const userInfo = getUserInfo();
   if (userInfo.role === 'admin') {
      alert('Admins are not allowed to modify annotations.');
      return;
  } else {
    const updatedMap = { ...dropdownSelectionMap, [uid]: value };
    setDropdownSelectionMap(updatedMap);
    console.log('********* Pending Alert UIDs Ref:', pendingAlertUIDsRef);

    triggerPost({
      allAnnotations: annotation.state.getAllAnnotations(),
      dropdownSelectionMap: updatedMap,
      suppressAlert: true,
      pendingAlertUIDsRef,
    });
}
};