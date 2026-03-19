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
  onClick?: (segmentLabel) => void;
};

export const SegmentationItem = ({
  uid,
  label,
  segments,
  onClick,
}: Props) => {
        const segmentArray = Object.values(segments || {});


    return(

        <li className="segmentation-item">

            <span className="segmentation-label" > {label} </span>
            {segmentArray.length > 0 && (
                // <div className="segment-scroll-x">
                <ul className="segment-list">
                    {segmentArray.map((segment) => (
                        <li key={segment.segmentIndex} className="segment-item"  onClick={() => onClick(segment.label)}>
                            {segment.label || `Segment ${segment.segmentIndex}`}
                        </li>
                    ))}
                </ul>
                // </div>
            )}

        </li>
    )
};
