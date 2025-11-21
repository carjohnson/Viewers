import React from 'react';
import Select from 'react-select';
import { EyeIcon, EyeOffIcon } from '../../utils/CreateCustomIcon';

type Props = {
  uid: string;
  label: string;
  scoreOptions: { value: number; label: string }[];
  selectedScore: number;
  isVisible: boolean;
  onMenuOpen: () => void;
  onDropdownChange: (value: number) => void;
  onClick: () => void;
  onToggleVisibility: () => void;
};

export const AnnotationItem = ({
  uid,
  label,
  scoreOptions,
  selectedScore,
  isVisible,
  onMenuOpen,
  onDropdownChange,
  onClick,
  onToggleVisibility,
}: Props) => (
  <li className="annotation-item">
    <Select
      options={scoreOptions}
      value={scoreOptions.find(opt => opt.value === selectedScore)}
      onMenuOpen={onMenuOpen}
      onChange={(option) => onDropdownChange(option!.value)}
      getOptionLabel={(e) => e.label}
      styles={{
        control: (base) => ({
          ...base,
          backgroundColor: 'transparent',
          borderColor: '#ccc',
          color: 'white',
        }),
        singleValue: (base) => ({ ...base, color: 'white' }),
        menu: (base) => ({ ...base, backgroundColor: '#222', color: 'white' }),
        option: (base, state) => ({
          ...base,
          backgroundColor: state.isFocused ? '#444' : '#222',
          color: 'white',
        }),
      }}
      placeholder="Suspicion score"
    />
    <span className="annotation-label" onClick={onClick}>
      {label}
    </span>
    <span
      className="annotation-visibility"
      onClick={onToggleVisibility}
      title={isVisible ? 'Hide annotation' : 'Show annotation'}
    >
      {isVisible ? <EyeIcon /> : <EyeOffIcon />}
    </span>
  </li>
);