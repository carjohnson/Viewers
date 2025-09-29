// src/handlers/dropdownHandlers.ts

import { setUserInfo, getUserInfo } from './../../../../../modes/@ohif/mode-webquiz/src/userInfoService';

export const handleDropdownChange = ({
  uid,
  value,
  dropdownSelectionMap,
  setDropdownSelectionMap,
  triggerPost,
  annotation,
}: {
  uid: string;
  value: number;
  dropdownSelectionMap: Record<string, number>;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  triggerPost: (args: { allAnnotations: any; dropdownSelectionMap: Record<string, number> }) => void;
  annotation: any;
}) => {
  const userInfo = getUserInfo();
   if (userInfo.role === 'admin') {
      alert('Admins are not allowed to modify annotations.');
      return;
  } else {
    const updatedMap = { ...dropdownSelectionMap, [uid]: value };
    setDropdownSelectionMap(updatedMap);

    const allAnnotations = annotation.state.getAllAnnotations?.() || [];

    triggerPost({
      allAnnotations,
      dropdownSelectionMap: updatedMap,
    });
}
};