import React from 'react';
import Select from 'react-select';
import { EyeIcon, EyeOffIcon } from '../../utils/CreateCustomIcon';

/** Define display of each annotation item in the list. 
 *  If the user role is admin, an invalid score is assigned and
 *  because it is out of the allowed range, the dropdown title is displayed.
 */

type Props = {
  uid: string;
  label: string;
  scoreOptions: { value: number; label: string }[];
  selectedScore: number;
  isVisible: boolean;
  onClick: () => void;
  onToggleVisibility: () => void;
  isAdmin: boolean;
  onScoreClick: (uid: string, currentScore: number | null) => void;
};

export const AnnotationItem = ({
  uid,
  label,
  scoreOptions,
  selectedScore,
  isVisible,
  onClick,
  onToggleVisibility,
  isAdmin,
  onScoreClick,
}: Props) => {
  const scoreLabel =
    scoreOptions.find(opt => opt.value === selectedScore)?.label ??
    "Set score";

  return (
    <li className="annotation-item">
      <span
        className="annotation-score-pill"
        onClick={() => !isAdmin && onScoreClick(uid, selectedScore)}
        style={{
          padding: "4px 10px",
          borderRadius: "4px",
          border: "1px solid #ccc",
          background: "#222",
          color: "white",
          cursor: isAdmin ? "default" : "pointer",
          userSelect: "none",
          minWidth: "80px",
          textAlign: "center",
          display: "inline-block",
        }}
      >
        {isAdmin ? "N/A" : scoreLabel}
      </span>

      <span className="annotation-label" onClick={onClick}>
        {label}
      </span>

      <span
        className="annotation-visibility"
        onClick={onToggleVisibility}
        title={isVisible ? "Hide annotation" : "Show annotation"}
      >
        {isVisible ? <EyeIcon /> : <EyeOffIcon />}
      </span>
    </li>
  );
};
