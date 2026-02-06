import React from 'react';
import { Button } from '@ohif/ui'; // or your preferred button source
import { postSegmentations } from '../handlers/postSegmentations';
import {UserInfo} from '../models/UserInfo';
import dcmjs from 'dcmjs';

// for creating the blob
const { DicomMetaDictionary, DicomDict } = dcmjs.data;
const ImplementationClassUID = '2.25.270695996825855179949881587723571202391.2.0.0';
const ImplementationVersionName = 'OHIF-3.12.0';
const EXPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2.1';



type Props = {
  getUserInfo: () => UserInfo | null;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  segmentationService: any;
  activeViewportImageIds: [string] | null;
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
  activeViewportImageIds,
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
    let updatedSeg = undefined;
    let lastSegId = "";

    for (const seg of allSegmentations) {

        // because this is a custom segmentation extension, 
        //      predecessorImage prop is missing from the seg
        debugger;
        const imageId = activeViewportImageIds[0];
        segmentationService.addOrUpdateSegmentation({
            segmentationId: seg.segmentationId,
            type: seg.type,
            predecessorImageId: imageId
        });
        updatedSeg = segmentationService.getSegmentation(seg.segmentationId);
        // console.log('updatedSeg after update', updatedSeg);


        const generatedSeg = commandsManager.runCommand('generateSegmentation', {
            segmentationId: seg.segmentationId,
            });
        console.log(' *** GENERATED SEG:', generatedSeg);

        // generate the meta data 
        const meta = {
              FileMetaInformationVersion: generatedSeg.dataset._meta?.FileMetaInformationVersion?.Value,
              MediaStorageSOPClassUID: generatedSeg.dataset.SOPClassUID,
              MediaStorageSOPInstanceUID: generatedSeg.dataset.SOPInstanceUID,
              TransferSyntaxUID: EXPLICIT_VR_LITTLE_ENDIAN,
              ImplementationClassUID,
              ImplementationVersionName,
            };

        const denaturalizedMetadata = dcmjs.data.DicomMetaDictionary.denaturalizeDataset(meta);
        const denaturalizedDataset = dcmjs.data.DicomMetaDictionary.denaturalizeDataset(generatedSeg.dataset);
        const dicomDict = new DicomDict(denaturalizedMetadata);
        dicomDict.dict = denaturalizedDataset;
        const arrayBuffer = dicomDict.write();

        let segBlob = undefined;
        try {
        segBlob = new Blob([arrayBuffer], { type: 'application/dicom' });
        console.log('Blob created successfully, size:', segBlob.size, 'type:', segBlob.type);
        console.log('segBlob:', segBlob);
        
        } catch (blobError) {
        console.error('Blob creation FAILED:', blobError);
        console.error('Stack:', blobError.stack);
        }


        const segmentationItem = {
            segmentationId: seg.segmentationId,
            seriesInstanceUid: seriesInstanceUID,
            label: seg.label,
            segments: buildSegmentList(seg.segments),
            segmentationDataRef: segBlob,
        };

        segmentationObjects.push(segmentationItem);
        lastSegId = seg.segmentationId;
    }

    debugger;


    // console.log('=== DEBUG BEFORE DOWNLOAD ===');
    // console.log('lastSegId:', lastSegId);
    // const segData = segmentationService.getSegmentation(lastSegId);
    // console.log('segData.predecessorImageId:', segData?.predecessorImageId);
    // console.log('active imageId:', activeViewportImageIds[0]);
    // console.log('===========================');


    // // DEBUG ... Now trigger the download 
    // //    - frontend download for testing import DICOM SEG into other viewer
    // commandsManager.runCommand("downloadSegmentation", {
    //     segmentationId: lastSegId,
    //     predecessorImageId: activeViewportImageIds[0],
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
    lesionLocation: ["zone-1","zone-2"],
    lesionReferenceScore: "follow-up",
  }));
}
