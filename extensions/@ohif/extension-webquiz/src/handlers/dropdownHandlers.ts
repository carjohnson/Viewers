// src/handlers/dropdownHandlers.ts

import { setUserInfo, getUserInfo } from './../../../../../modes/@ohif/mode-webquiz/src/userInfoService';

export const handleDropdownChange = ({
  uid,
  value,
  selectionMap,
  setSelectionMap,
  triggerPost,
  annotation,
}: {
  uid: string;
  value: number;
  selectionMap: Record<string, number>;
  setSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  triggerPost: (args: { allAnnotations: any; selectionMap: Record<string, number> }) => void;
  annotation: any;
}) => {
  const userInfo = getUserInfo();
   if (userInfo.role === 'admin') {
      alert('Admins are not allowed to modify annotations.');
      return;
  } else {
    const updatedMap = { ...selectionMap, [uid]: value };
    setSelectionMap(updatedMap);

    const allAnnotations = annotation.state.getAllAnnotations?.() || [];

    triggerPost({
      allAnnotations,
      selectionMap: updatedMap,
    });
}
};