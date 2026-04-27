import React from 'react';
import Select from 'react-select';

/** Define display of each annotation item in the list. 
 *  If the user role is admin, an invalid score is assigned and
 *  because it is out of the allowed range, the dropdown title is displayed.
 */

type Props = {
  uid: string;
  label: string;
  segments: Array<{
    segmentIndex: number;
    label: string;
  }>;
  completedSegments: Record<string,boolean>;
  onClick?: ({label, segmentLabel, arrayIndex, segmentIndex}) => void;
};

export const SegmentationItem = ({
  uid,
  label,
  segments,
  completedSegments,
  onClick,
}: Props) => {
        const segmentArray = Object.values(segments || {});


    return(

        <li className="segmentation-item">

            <span className="segmentation-label" > {label} </span>
            {segmentArray.length > 0 && (
                <ul className="segment-list">
                    {segmentArray.map((segment, index) => {
                        const isCompleted = completedSegments[segment.segmentIndex];

                        return (
                        <li
                            key={segment.segmentIndex}
                            className="segment-item"
                            onClick={() => onClick({label, segmentLabel: segment.label, arrayIndex: index, segmentIndex: segment.segmentIndex,})}
                        >
                            {segment.label || `Segment ${segment.segmentIndex}`}

                            {isCompleted && (
                            <span className="segment-complete-marker">✔</span>
                            )}
                        </li>
                        );
                    })}
                </ul>
            )}
        </li>
    );
};
