
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
