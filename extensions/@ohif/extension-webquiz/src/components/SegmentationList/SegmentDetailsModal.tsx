import React, { useEffect, useState } from 'react';
import Select from 'react-select';


 export const SegmentDetailsModal = ({
  segmentationId,
  segmentLabel,
  groundTruth,
  referenceStandardMethod,
  hepaticSegment,
  onSaveSegmentData,
}) => {

  const [selectedGroundTruth, setSelectedGroundTruth] = useState(null);
  const [selectedReferenceMethod, setSelectedReferenceMethod] = useState(null);
  const [selectedHepaticSegments, setSelectedHepaticSegments] = useState([]);

  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("info"); 
  

  useEffect(() => {
    onSaveSegmentData(() => {
      if (!selectedGroundTruth || !selectedReferenceMethod || selectedHepaticSegments.length === 0) {
        setStatusType("error");
        setStatusMessage("Missing required fields");
        return null;
      } else {
        setStatusType("info");
        setStatusMessage("Saving ...");

        // simulate async save
           setTimeout(() => {
             setStatusType("success");
             setStatusMessage("Saved successfully!");
           }, 800);

        return {
          groundTruth: selectedGroundTruth,
          referenceMethod: selectedReferenceMethod,
          hepaticSegments: selectedHepaticSegments,
        };
      }      
    });
  }, [
    selectedGroundTruth,
    selectedReferenceMethod,
    selectedHepaticSegments,
  ]);



  return (
  <div className="custom-modal-container">

    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
        Segment {segmentationId}: {segmentLabel}
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
            options={groundTruth}
            classNamePrefix="dd"
            placeholder="Ground Truth"
            value={selectedGroundTruth}
            onChange={(val) => setSelectedGroundTruth(val)}
          />
        </div>

        <div style={{ flex: "0 1 auto" }}>
          <Select
            options={referenceStandardMethod}
            classNamePrefix="dd"
            placeholder="Reference Standard Method"
            value={selectedReferenceMethod}
            onChange={(val) => setSelectedReferenceMethod(val)}
          />
        </div>
      </div>

      {/* Hepatic Segment checkbox group */}
      <div className="hepatic-checkbox-group">
        <div className="checkbox-title">Hepatic Segments</div>

        <div className="checkbox-list">
          {hepaticSegment.map((item) => (
            <label key={item.value} className="checkbox-item">
            <input
              type="checkbox"
              value={item.label}   // ← use label instead of value
              checked={selectedHepaticSegments.includes(item.label)}
              onChange={(e) => {
                const label = e.target.value;
                setSelectedHepaticSegments((prev) =>
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
