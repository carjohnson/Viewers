import React, { useMemo } from 'react';
import './SegmentationList.css';
import {UserInfo} from './../../models/UserInfo';
import { lesionReferenceStandard, decisionCriteria } from './../../models/ScoreOptions'

type Props = {
    getUserInfo: () => UserInfo | null;
}

export const SegmentationList = ({
    getUserInfo,
}: Props) => {



    return (
        <div>
            {getUserInfo()?.role == 'admin' && (
                <fieldset className="segmentation-group">
                <legend>Segmentations</legend>
                <div className="segmentation-scroll">
                    <ul>
                    </ul>
                </div>


                </fieldset>
            )}
        </div>
    )
}