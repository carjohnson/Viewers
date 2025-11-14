import { useEffect, useState } from 'react';
import { validateSeriesFromDB } from '../handlers/validateSeriesHandler';
import { API_BASE_URL } from './../config/config';

export const useSeriesValidation = ({ studyUID, seriesUID, onValidated }) => {
  const [isValid, setIsValid] = useState(null);

  useEffect(() => {
    const validate = async () => {
      // console.log(`🔍 Validating series ${seriesUID} for study ${studyUID}`);
      const result = await validateSeriesFromDB({ baseUrl: API_BASE_URL, studyUID, seriesUID });
      // console.log(`📋 Validation result for ${seriesUID}:`, result?.isValid);
      setIsValid(result?.isValid ?? false);
      onValidated?.(seriesUID, result?.isValid ?? false);
    };

    if (studyUID && seriesUID) validate();
  }, [studyUID, seriesUID]);

  return isValid;
};