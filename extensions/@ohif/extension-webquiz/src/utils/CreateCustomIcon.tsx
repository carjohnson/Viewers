
import React from 'react';
import baineslogo from '../../assets/BainesTransparentTiny.png';

type ImageIconProps = React.ImgHTMLAttributes<HTMLImageElement>;


const CreateCustomIcon = (Icons) => {
//   console.log('📦 Icons keys:', Object.keys(Icons));   // for debug

  const BaineslogoIcon = (props: ImageIconProps) => {
    const { width = 22, height = 22, ...rest } = props;
    return <img src={baineslogo} width={width} height={height} {...rest} />;
  };

  Icons.addIcon('baines-logo', BaineslogoIcon);

};

export default CreateCustomIcon;

//===============================

export const EyeIcon = ({ size = 20, color = '#888' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    fill="none"
    viewBox="0 0 24 24"
    stroke={color}
    strokeWidth={2}
    style={{ marginLeft: '8px' }}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

//===============================

export const EyeOffIcon = ({ size = 20, color = '#888' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    fill="none"
    viewBox="0 0 24 24"
    stroke={color}
    strokeWidth={2}
    style={{ marginLeft: '8px' }}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 3l18 18M10.584 10.587a3 3 0 004.829 3.417M9.88 5.07A9.956 9.956 0 0121 12c-1.274 4.057-5.065 7-9.542 7a9.956 9.956 0 01-6.88-2.93M6.18 6.18A9.956 9.956 0 003 12c1.274 4.057 5.065 7 9.542 7a9.956 9.956 0 006.88-2.93"
    />
  </svg>
);