// src/components/AnnotationList.tsx
import React from 'react';
import Select from 'react-select';
import { EyeIcon, EyeOffIcon } from '../utils/CreateCustomIcon';
import { TriggerPostArgs } from '../models/TriggerPostArgs';

type Props = {
  measurementList: any[];
  dropdownSelectionMap: Record<string, number>;
  visibilityMap: Record<string, boolean>;
  scoreOptions: { value: number; label: string }[];
  onDropdownChange: (uid: string, value: number) => void;
  onMeasurementClick: (uid: string) => void;
  onToggleVisibility: (uid: string) => void;
  triggerPost: (args: TriggerPostArgs) => void;
  annotation: any;
};

export const AnnotationList = ({
  measurementList,
  dropdownSelectionMap,
  visibilityMap,
  scoreOptions,
  onDropdownChange,
  onMeasurementClick,
  onToggleVisibility,
  triggerPost,
  annotation,
}: Props) => {
  return (
    <div>
      {/* <br />
      <br />
      <button
        onClick={() =>
          triggerPost({
            allAnnotations: annotation.state.getAllAnnotations(),
            dropdownSelectionMap,
          })
        }
      >
        Submit measurements
      </button>

      <br />
      <br /> */}
      <div>
        <h3>Annotations</h3>
        <h4 style={{ textAlign: 'left' }}>Score</h4>
        <ul>
          {measurementList.map((measurement, index) => {
            const uid = measurement.uid;
            const isVisible = visibilityMap[uid] ?? true;

            return (
              <li
                key={uid || index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  borderBottom: '1px solid #ccc',
                }}
              >
                <Select
                  options={scoreOptions}
                  value={scoreOptions.find(opt => opt.value === dropdownSelectionMap[uid])}
                  onChange={(option) => onDropdownChange(uid, option.value)}
                  getOptionLabel={(e) => e.label}
                  styles={{
                    control: (base) => ({
                      ...base,
                      backgroundColor: 'transparent',
                      borderColor: '#ccc',
                      color: 'white',
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: 'white',
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: '#222',
                      color: 'white',
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isFocused ? '#444' : '#222',
                      color: 'white',
                    }),
                  }}
                  placeholder="Suspicion score"
                />

                <span
                  style={{ flexGrow: 1, cursor: 'pointer' }}
                  onClick={() => onMeasurementClick(uid)}
                >
                  {measurement.label || `Measurement ${index + 1}`}
                </span>

                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() => onToggleVisibility(uid)}
                  title={isVisible ? 'Hide annotation' : 'Show annotation'}
                >
                  {isVisible ? <EyeIcon /> : <EyeOffIcon />}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};