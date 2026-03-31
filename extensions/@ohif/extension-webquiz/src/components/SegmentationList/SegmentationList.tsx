import React, { useMemo } from 'react';
import './SegmentationList.css';
import {UserInfo} from './../../models/UserInfo';
import { SegmentationItem } from './SegmentationItem';
import { useSegmentMetadataStore } from '../../stores/useSegmentMetadataStore';

type Props = {
    getUserInfo: () => UserInfo | null;
    segmentationList: any[];
    onSegmentClick: (uid: string, segmentLabel: string, arrayIndex: number, segmentIndex: number) => void;
}

export const SegmentationList = ({
    getUserInfo,
    segmentationList,
    onSegmentClick,
}: Props) => {
    
    const metadata = useSegmentMetadataStore(state => state.metadata);

    return (
        <div>
            {getUserInfo()?.role == 'admin' && (
                <fieldset className="segmentation-group">
                <legend>Segmentations</legend>
                <div className="segmentation-scroll">
                    <ul>
                        {segmentationList.map((segmentation, index) => {
                            const uid = segmentation.segmentationId;
                            const segments = segmentation.segments || [];
                            const segmentArray = Object.values(segments || {}) as Array<{
                                segmentIndex: number;
                                label: string;
                                }>;

                            const completionMap: Record<number, boolean> = {};

                            segmentArray.forEach(seg => {
                                const segMeta = metadata[uid]?.[seg.segmentIndex];
                                completionMap[seg.segmentIndex] = segMeta?.isComplete ?? false;
                            });

                            return (
                                <SegmentationItem
                                    key={uid || index}
                                    uid={uid}
                                    label={segmentation.label || `Segmentation ${index + 1}`}
                                    segments={segmentation.segments || []}
                                    completedSegments={ completionMap }
                                    onClick={({segmentLabel, arrayIndex, segmentIndex}) => onSegmentClick(uid, segmentLabel, arrayIndex, segmentIndex)}
                                />
                            )
                        })}
                    </ul>
                </div>
                </fieldset>
            )}
        </div>
    )
}