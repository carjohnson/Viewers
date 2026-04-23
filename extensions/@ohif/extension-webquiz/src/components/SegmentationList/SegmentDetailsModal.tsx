import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { SegmentMetadata } from '../../models/SegmentationData';


//  export const SegmentDetailsModal = ({
//   segmentationId,
//   segmentLabel,
//   groundTruth,
//   referenceStandardMethod,
//   hepaticSegment,
//   onSaveSegmentData,
// }) => {

  // const [selectedGroundTruth, setSelectedGroundTruth] = useState(null);
  // const [selectedReferenceMethod, setSelectedReferenceMethod] = useState(null);
  // const [selectedHepaticSegments, setSelectedHepaticSegments] = useState([]);

  export const SegmentDetailsModal = ({
  segmentationId,
  segmentLabel,

  groundTruthOptions,
  referenceMethodOptions,
  hepaticSegmentOptions,

  selectedGroundTruth,
  selectedReferenceMethod,
  selectedHepaticSegments,

  onSaveSegmentData,
}) => {

  const [groundTruthValue, setGroundTruthValue] = useState(null);
  const [referenceMethodValue, setReferenceMethodValue] = useState(null);
  const [hepaticValues, setHepaticValues] = useState([]);

  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("info"); 
  


  // Hydrate from props
  useEffect(() => {
    if (selectedGroundTruth) {
      const match = groundTruthOptions.find(o => o.label === selectedGroundTruth);
      setGroundTruthValue(match || null);
    }

    if (selectedReferenceMethod) {
      const match = referenceMethodOptions.find(o => o.label === selectedReferenceMethod);
      setReferenceMethodValue(match || null);
    }

    if (selectedHepaticSegments?.length > 0) {
      setHepaticValues(selectedHepaticSegments);
    }
  }, []);


  useEffect(() => {
    onSaveSegmentData(() => {
      if (!groundTruthValue || !referenceMethodValue || hepaticValues.length === 0)  {
        setStatusType("error");
        setStatusMessage("Missing required fields");
        return false;
      } else {

        setStatusType("info");
        setStatusMessage("Saving ...");

        // simulate async save
           setTimeout(() => {
             setStatusType("success");
             setStatusMessage("Saved successfully!");
           }, 800);

        return {
          groundTruth: groundTruthValue,
          referenceMethod: referenceMethodValue,
          hepaticSegments: hepaticValues,
        };
      }      
    });
  }, [groundTruthValue, referenceMethodValue, hepaticValues]);



  return (
  <div className="custom-modal-container">

    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
        Segment: {segmentLabel}
      </div>

      {/* Status line */}
      {statusMessage && (
        <div
          className={`status-line ${statusType}`}
        >
          {statusMessage}
        </div>
      )}

      {/* Row of dropdowns */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "1rem",
          width: "100%",
        }}
      >
        <div style={{ flex: "0 1 auto" }}>
          <Select
            options={groundTruthOptions}
            classNamePrefix="dd"
            placeholder="Ground Truth"
            value={groundTruthValue}
            onChange={(val) => setGroundTruthValue(val)}
          />
        </div>

        <div style={{ flex: "0 1 auto" }}>
          <Select
            options={referenceMethodOptions}
            classNamePrefix="dd"
            placeholder="Reference Standard Method"
            value={referenceMethodValue}
            onChange={(val) => setReferenceMethodValue(val)}
          />
        </div>
      </div>

      {/* Hepatic Segment checkbox group */}
      <div className="hepatic-checkbox-group">
        <div className="checkbox-title">Hepatic Segments</div>

        <div className="checkbox-list">
          {hepaticSegmentOptions.map((item) => (
            <label key={item.value} className="checkbox-item">
            <input
              type="checkbox"
              value={item.label}   // ← use label instead of value
              checked={hepaticValues.includes(item.label)}
              onChange={(e) => {
                const label = e.target.value;
                setHepaticValues((prev) =>
                  prev.includes(label)
                    ? prev.filter((v) => v !== label)
                    : [...prev, label]
                );
              }}
            />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

    </div>
  </div>
  );

};
