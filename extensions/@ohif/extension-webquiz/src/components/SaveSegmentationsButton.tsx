import React from 'react';
import { Button } from '@ohif/ui'; // or your preferred button source
import { postSegmentations } from '../handlers/postSegmentations';
import {UserInfo} from '../models/UserInfo'


type Props = {
  getUserInfo: () => UserInfo | null;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  segmentationService: any;
  commandsManager: any;
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
  segmentationService,
  commandsManager,
  showModal,
  closeModal,
}) => {
  const handleClick = () => {



    //   showModal({
    //     title: 'Confirm Save Segmentations',
    //     message: 'Are you sure?',
    //     showCancel: true,
    //     onCancel: () => {
    //       console.log('❌ Cancelled save segmentations to DB');
    //       closeModal();
    //     },
    //     onClose: confirmCompletion,
    //   });
    confirmCompletion();
  };


  const confirmCompletion = async () => {
    
    const allSegmentations = segmentationService.getSegmentations();
    console.log(' *** In SaveSegmentationsButton ... all Segmentations', allSegmentations);

    let segmentationObjects = [];
    let lastSegId = "";
    allSegmentations.forEach((seg) => {
        const segmentationItem = {
            "segmentationId": seg.segmentationId,
            "seriesInstanceUid": seriesInstanceUID,
            "label": seg.label,
            "segments": buildSegmentList(seg.segments),
            "segmentDataRef": "to-be-assigned",
        }

        segmentationObjects.push(segmentationItem);
        lastSegId = segmentationItem.segmentationId;
            

    });
        commandsManager.runCommand('downloadSegmentation', {
            segmentationId: lastSegId});
        // const blob = await commandsManager.runCommand('generateSegmentation', {
        //     segmentationId: lastSegId,
        // });
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


// >>>>>>>>>>>>> Helper functions <<<<<<<<<<<<<

type OhifSegment = {
  segmentIndex: number;
  label: string;
  // add other OHIF fields if needed
};
function buildSegmentList(segmentsObj) {
  if (!segmentsObj) return [];

  const segmentArray = Object.values(segmentsObj) as OhifSegment[]; // OHIF stores segments as an object

  return segmentArray.map(segment => ({
    segmentIndex: segment.segmentIndex,
    label: segment.label,
    location: "zone-1",
    referenceScore: "follow-up",
  }));
}