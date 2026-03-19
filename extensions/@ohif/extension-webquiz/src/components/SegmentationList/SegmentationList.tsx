import React, { useMemo } from 'react';
import './SegmentationList.css';
import {UserInfo} from './../../models/UserInfo';
import { SegmentationItem } from './SegmentationItem';

type Props = {
    getUserInfo: () => UserInfo | null;
    segmentationList: any[];
    onSegmentationClick: (uid: string, label: string) => void;
}

export const SegmentationList = ({
    getUserInfo,
    segmentationList,
    onSegmentationClick,
}: Props) => {



    return (
        <div>
            {getUserInfo()?.role == 'admin' && (
                <fieldset className="segmentation-group">
                <legend>Segmentations</legend>
                <div className="segmentation-scroll">
                    <ul>
                        {segmentationList.map((segmentation, index) => {
                            const uid = segmentation.uid;
                            return (
                                <SegmentationItem
                                    key={uid || index}
                                    uid={uid}
                                    label={segmentation.label || `Segmentation ${index + 1}`}
                                    segments={segmentation.segments || []}
                                    onClick={(segmentLabel) => onSegmentationClick(uid, segmentLabel)}
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