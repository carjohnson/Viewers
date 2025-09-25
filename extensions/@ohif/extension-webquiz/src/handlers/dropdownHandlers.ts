// src/handlers/dropdownHandlers.ts
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
  const updatedMap = { ...selectionMap, [uid]: value };
  setSelectionMap(updatedMap);

  const allAnnotations = annotation.state.getAllAnnotations?.() || [];

  triggerPost({
    allAnnotations,
    selectionMap: updatedMap,
  });
};