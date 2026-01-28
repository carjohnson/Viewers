import React from 'react';
import { Button } from '@ohif/ui'; // or your preferred button source
import { postSegmentations } from '../handlers/postSegmentations';
import {UserInfo} from '../models/UserInfo'


type Props = {
  getUserInfo: () => UserInfo | null;
  studyInstanceUID: string;
  seriesInstanceUID: string;

  showModal: (args: {
    title: string;
    message: string;
    onClose?: () => void;
    showCancel?: boolean;
    onCancel?: () => void;
  }) => void;
  closeModal: () => void;
};

const SaveSegmentationsButton: React.FC<Props> = ({
  getUserInfo,
  studyInstanceUID,
  seriesInstanceUID,
  showModal,
  closeModal,
}) => {
  const handleClick = () => {



      showModal({
        title: 'Confirm Save Segmentations',
        message: 'Are you sure?',
        showCancel: true,
        onCancel: () => {
          console.log('❌ Cancelled save segmentations to DB');
          closeModal();
        },
        onClose: confirmCompletion,
      });
    
  };


  const confirmCompletion = async () => {

    // test post
    console.log("OHIF window:", window.location.href);
    // console.log("OHIF parent:", window.parent.location.href);
    const segmentationObjects = [
        
        
        {
        "segmentationId": "uuid-1",
        "seriesInstanceUid": seriesInstanceUID,
        "label": "Segmentation 1a",
        "segments": [
            {
            "segmentIndex": 1,
            "label": "Segment 1",
            "location": "zone-1a",
            "referenceScore": "follow-up",
            "color": [255, 0, 0, 1],
            "opacity": 0.8,
            "visibility": true,
            "isLocked": false
            }
        ],
        "segmentationDataRef": "some-json-or-reference-string"
        },
        {
        "segmentationId": "uuid-2",
        "seriesInstanceUid": seriesInstanceUID,
        "label": "Segmentation 2",
        "segments": [
            {
            "segmentIndex": 1,
            "label": "Segment 1",
            "location": "zone-2a",
            "referenceScore": "follow-up",
            "color": [0, 255, 0, 1],
            "opacity": 0.8,
            "visibility": true,
            "isLocked": false
            },
            {
            "segmentIndex": 2,
            "label": "Segment 2",
            "location": "zone-2a",
            "referenceScore": "follow-up - 3mos",
            "color": [0, 0, 255, 1],
            "opacity": 0.8,
            "visibility": true,
            "isLocked": false
            }            
        ],
        "segmentationDataRef": "some-other-json-or-reference-string"
        }

    ]
    

    const postSegmentationResult = await postSegmentations({
        segmentationObjects,
        studyUID: studyInstanceUID,
    });

    if (postSegmentationResult?.error) {
      console.warn('⚠️ Failed to post segmentations:', postSegmentationResult.error);
    } else {
      console.log(`📌 Segmentations posted for ${studyInstanceUID}`);
    }
    
    console.log(`📬 Confirmed save segmentations to DB`);

    closeModal();


  };  

  return (
    <div className="p-2 text-center">
        {getUserInfo()?.role == 'admin' && (
            <Button
            onClick={handleClick}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold rounded px-4 py-2"
            >
            { 'Save Segmentations' }
            </Button>
        )}
    </div>
  );
};

export default SaveSegmentationsButton;
