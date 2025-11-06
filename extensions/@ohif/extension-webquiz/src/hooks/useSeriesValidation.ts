import { useEffect, useState } from 'react';
import { validateSeriesFromDB } from '../handlers/validateSeriesHandler';
import { API_BASE_URL } from './../config/config';


export const useSeriesValidation = ({ studyUID, seriesUID }) => {
  const [isValid, setIsValid] = useState(null);

  useEffect(() => {
    const validate = async () => {
      const result = await validateSeriesFromDB({ baseUrl: API_BASE_URL, studyUID, seriesUID });
      setIsValid(result?.isValid ?? false);
    };
    if (studyUID && seriesUID) validate();
  }, [studyUID, seriesUID]);

  return isValid;
};