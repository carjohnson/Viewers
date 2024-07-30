import React from 'react';
import { sqrt } from 'math.js'

/**
 *  Creating a React component to be used as a side panel in OHIF.
 *  Also performs a simple div that uses Math.js to output the square root.
 */
function ImageQuizzerSidePanelComponent() {
    return (
        <div className="text-white w-full text-center">
            {`Image Quizzer version : ${sqrt(4)}`}
        </div>
    );
}
export default ImageQuizzerSidePanelComponent;
