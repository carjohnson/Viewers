import React from 'react';
import Select from 'react-select';

 export const SegmentDetailsModal = ({
  segmentationId,
  segmentLabel,
  groundTruth,
  referenceStandardMethod,
  hepaticSegment,
}) => {


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
        Segment {segmentationId}: {segmentLabel}
      </div>

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
          />
        </div>

        <div style={{ flex: "0 1 auto" }}>
          <Select
            options={referenceStandardMethod}
            classNamePrefix="dd"
            placeholder="Reference Standard Method"
          />
        </div>
      </div>

      {/* Hepatic Segment checkbox group */}
      <div className="hepatic-checkbox-group">
        <div className="checkbox-title">Hepatic Segments</div>

        <div className="checkbox-list">
          {hepaticSegment.map((item) => (
            <label key={item.value} className="checkbox-item">
              <input type="checkbox" value={item.value} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );


};

