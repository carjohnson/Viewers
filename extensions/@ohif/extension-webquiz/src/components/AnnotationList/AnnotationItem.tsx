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
  onMenuOpen: () => void;
  onDropdownChange: (value: number) => void;
  onClick: () => void;
  onToggleVisibility: () => void;
  isAdmin: boolean;
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
  isAdmin,
}: Props) => (
  <li className="annotation-item">
    <Select
      options={scoreOptions}
      value={isAdmin ? scoreOptions.find(opt => opt.value === 99) : scoreOptions.find(opt => opt.value === selectedScore)}
      isDisabled={isAdmin}
      onMenuOpen={!isAdmin ? onMenuOpen: undefined}
      onChange={(option) => !isAdmin && onDropdownChange(option!.value)}
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