export type TriggerPostArgs = {
  allAnnotations: any[];
  dropdownSelectionMap: Record<string, number>;
  suppressAlert: boolean;
  pendingAlertUIDsRef: React.RefObject<string[]>;
};