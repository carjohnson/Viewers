// src/components/AnnotationList.tsx

import React, { useMemo } from 'react';
import { AnnotationItem } from './AnnotationItem';
import { TriggerPostArgs } from '../../models/TriggerPostArgs';
import { getUserInfo } from './../../../../../../modes/@ohif/mode-webquiz/src/userInfoService';

import './AnnotationList.css';





type Props = {
  measurementList: any[];
  dropdownSelectionMap: Record<string, number>;
  visibilityMap: Record<string, boolean>;
  scoreOptions: { value: number; label: string }[];
  onMeasurementClick: (uid: string) => void;
  onToggleVisibility: (uid: string) => void;
  triggerPost: (args: TriggerPostArgs) => void;
  annotation: any;
  onScoreClick: (uid: string, currentScore: number | null) => void;
};

export const AnnotationList = ({
  measurementList,
  dropdownSelectionMap,
  visibilityMap,
  scoreOptions,
  onMeasurementClick,
  onToggleVisibility,
  onScoreClick,
}: Props) => {

  const allVisible = useMemo(() => {
    return measurementList.every(m => visibilityMap[m.uid] !== false);
  }, [measurementList, visibilityMap]);

  const handleToggleAll = () => {
    measurementList.forEach(m => {
      const uid = m.uid;
      if (visibilityMap[uid] !== !allVisible) {
        onToggleVisibility(uid);
      }
    });
  };

  const userInfo = getUserInfo();
  const isAdmin = userInfo?.role === 'admin';


  return (
    <fieldset className="annotation-group">
      <legend>Annotations</legend>

      <div className="toggle-all-wrapper">
        <span className="score-column-label">Score</span>

        <button className="toggle-all-button" onClick={handleToggleAll}>
          {allVisible ? 'Hide All 🙈' : 'Show All 👁️'}
        </button>
      </div>

      <div className="annotation-scroll">
        <ul>
          {measurementList.map((measurement, index) => {
            const uid = measurement.uid;
            const isVisible = visibilityMap[uid] ?? true;
            const selectedScore = dropdownSelectionMap[uid];

            return (
              <AnnotationItem
                key={uid || index}
                uid={uid}
                label={measurement.label || `Measurement ${index + 1}`}
                scoreOptions={scoreOptions}
                selectedScore={selectedScore}
                isVisible={isVisible}
                onClick={() => onMeasurementClick(uid)}
                onToggleVisibility={() => onToggleVisibility(uid)}
                isAdmin={isAdmin}
                onScoreClick={() => onScoreClick(uid, selectedScore)}
              />
            );
          })}
        </ul>
      </div>
    </fieldset>
  );
};