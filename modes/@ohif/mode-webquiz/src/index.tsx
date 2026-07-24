import i18n from 'i18next';
import { id } from './id';
import initToolGroups from './initToolGroups';
import toolbarButtons from './toolbarButtons';

import setUpAutoTabSwitchHandler from './../../../segmentation/src/utils/setUpAutoTabSwitchHandler';
import { hotkeys } from '@ohif/core';
import { setUserInfo, getUserInfo, onUserInfoReady } from './userInfoService';
import { useSegmentationLoadStore } from './../../../../extensions/@ohif/extension-webquiz/src/stores/useSegmentationLoadStore';
import cornerstoneExtension from '@ohif/extension-cornerstone';
import { ohif, cornerstone, extensionDependencies, dicomRT, segmentation } from '@ohif/mode-basic';
export * from './toolbarButtons';



const configs = {
  Length: {},
  //
};

const href = window.location.search;
const params = new URLSearchParams(window.location.search);
const userRole = params.get('role');
// console.log(' *** IN MODE INDEX ... userRole:', userRole, 'href:',href, 'params:', params);


function modeFactory({ modeConfiguration }) {
    const _unsubscriptions = [];
  return {
    id,
    routeName: 'webquiz',
    displayName: 'Liver Study',

    onModeEnter:({servicesManager, extensionManager, commandsManager }: withAppTypes) => {

      const { 
        measurementService,
        toolbarService,
        toolGroupService,
        segmentationService,
        viewportGridService,
        panelService,
        } = servicesManager.services;

      measurementService.clearMeasurements();

      // Init Default and SR ToolGroups
      initToolGroups(extensionManager, toolGroupService, commandsManager);

      toolbarService.register(toolbarButtons);

      toolbarService.updateSection(toolbarService.sections.viewportActionMenu.topLeft, [
        'orientationMenu',
        'dataOverlayMenu',
      ]);

      toolbarService.updateSection(toolbarService.sections.viewportActionMenu.bottomMiddle, [
        'AdvancedRenderingControls',
      ]);

      toolbarService.updateSection('AdvancedRenderingControls', [
        'windowLevelMenuEmbedded',
        'voiManualControlMenu',
        'Colorbar',
        'opacityMenu',
        'thresholdMenu',
      ]);

      toolbarService.updateSection(toolbarService.sections.viewportActionMenu.topRight, [
        'modalityLoadBadge',
        'trackingStatus',
        'navigationComponent',
      ]);

      toolbarService.updateSection(toolbarService.sections.viewportActionMenu.bottomLeft, [
        'windowLevelMenu',
      ]);

      toolbarService.updateSection('MeasurementTools', [
        'Length',
        // 'Bidirectional',
        // 'ArrowAnnotate',
        // 'EllipticalROI',
        // 'RectangleROI',
        // 'CircleROI',
        // 'PlanarFreehandROI',
        // 'SplineROI',
        // 'LivewireContour',
      ]);

      toolbarService.updateSection('MoreTools', [
        'Reset',
        'rotate-right',
        'flipHorizontal',
        'ReferenceLines',
        'ImageOverlayViewer',
        'StackScroll',
        'invert',
        'Cine',
        'Magnify',
        'TagBrowser',
      ]);

      // >>>>>>>>>> Segmentation Setup <<<<<<<<<<<<<<
      toolbarService.updateSection(toolbarService.sections.labelMapSegmentationToolbox, [
        'LabelMapTools',
      ]);
      toolbarService.updateSection(toolbarService.sections.contourSegmentationToolbox, [
        'ContourTools',
      ]);

      toolbarService.updateSection('LabelMapTools', [
        'LabelmapSlicePropagation',
        'BrushTools',
        'MarkerLabelmap',
        'RegionSegmentPlus',
        'Shapes',
        'LabelMapEditWithContour',
      ]);
      toolbarService.updateSection('ContourTools', [
        'PlanarFreehandContourSegmentationTool',
        'SculptorTool',
        'SplineContourSegmentationTool',
        'LivewireContourSegmentationTool',
      ]);

      toolbarService.updateSection(toolbarService.sections.labelMapSegmentationUtilities, [
        'LabelMapUtilities',
      ]);
      toolbarService.updateSection(toolbarService.sections.contourSegmentationUtilities, [
        'ContourUtilities',
      ]);

      toolbarService.updateSection('LabelMapUtilities', [
        'InterpolateLabelmap',
        'SegmentBidirectional',
      ]);
      toolbarService.updateSection('ContourUtilities', [
        'LogicalContourOperations',
        'SimplifyContours',
        'SmoothContours',
      ]);

      toolbarService.updateSection('BrushTools', [
          'Brush',
          'Eraser',
          'Threshold',
          'SphereBrush',
          'SphereEraser',
          'ThresholdSphereBrush',
        ]);


      //=============================
      //Primary tools are based on the user's role
      //  - admins are not allowed to add or change annotations created by the MeasurementTools
      //  - request user info from server and wait for 'ready'

      // Send request to parent iframehost to get the user info
      window.parent.postMessage({ type: 'request-user-info' }, '*');

      // Listen for response
      const handleMessage = event => {
        if (event.data.type === 'user-info') {
          const userInfo = event.data.payload;
          console.log('✅ Mode > Received user info:', userInfo);
          setUserInfo(userInfo);    // to be available globally

          // Clean up listener
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

      // React when userInfo is ready - in case there is a delay from server
      onUserInfoReady(userInfo => {

          const commonPrimaryTools = [
            'Zoom',
            'Pan',
            'TrackballRotate',
            'WindowLevel',
            'Capture',
            'Layout',
            'Crosshairs',
            'MoreTools',
          ];

          const primaryTools = userInfo.role === 'admin'
            ? commonPrimaryTools
            : ['MeasurementTools', ...commonPrimaryTools];

          toolbarService.updateSection(toolbarService.sections.primary, primaryTools);

      });


      const { unsubscribeAutoTabSwitchEvents } = setUpAutoTabSwitchHandler({
        segmentationService,
        viewportGridService,
        panelService,
      });

      _unsubscriptions.push(...unsubscribeAutoTabSwitchEvents);



      //=============================

    },  // end onModeEnter

    onModeExit: ({ servicesManager }: withAppTypes) => {
      const {
        toolGroupService,
        syncGroupService,
        segmentationService,
        cornerstoneViewportService,
        uiDialogService,
        uiModalService,
      } = servicesManager.services;

      // reset the hasLoaded flags when leaving (eg. to return to study browser)
      useSegmentationLoadStore.getState().clearAllLoaded();

      
      _unsubscriptions.forEach(unsubscribe => unsubscribe());
      _unsubscriptions.length = 0;

      uiDialogService.hideAll();
      uiModalService.hide();
      toolGroupService.destroy();
      syncGroupService.destroy();
      segmentationService.destroy();
      cornerstoneViewportService.destroy();
    },
    validationTags: {
      study: [],
      series: [],
    },
    // /**
    //  * A boolean return value that indicates whether the mode is valid for the
    //  * modalities of the selected studies. For instance a PET/CT mode should be
    //  */
    // isValidMode: ({ modalities }) => {
    //   return { valid: true };
    // },
    /**
     * A boolean return value that indicates whether the mode is valid for the
     * modalities of the selected studies. Currently we don't have stack viewport
     * segmentations and we should exclude them
     */
    isValidMode: ({ modalities }) => {
      // Don't show the mode if the selected studies have only one modality
      // that is not supported by the mode
      const modalitiesArray = modalities.split('\\');
      return {
        valid:
          modalitiesArray.length === 1
            ? !['SM', 'ECG', 'OT', 'DOC'].includes(modalitiesArray[0])
            : true,
        description:
          'The mode does not support studies that ONLY include the following modalities: SM, OT, DOC',
      };
    },
    /**
     * Mode Routes are used to define the mode's behavior. A list of Mode Route
     * that includes the mode's path and the layout to be used. The layout will
     * include the components that are used in the layout. For instance, if the
     * default layoutTemplate is used (id: '@ohif/extension-default.layoutTemplateModule.viewerLayout')
     * it will include the leftPanels, rightPanels, and viewports. However, if
     * you define another layoutTemplate that includes a Footer for instance,
     * you should provide the Footer component here too. Note: We use Strings
     * to reference the component's ID as they are registered in the internal
     * ExtensionManager. The template for the string is:
     * `${extensionId}.{moduleType}.${componentId}`.
     */
      routes: [
      {
        path: 'webquiz',
        layoutTemplate: ({ location, servicesManager }) => {
          let rightPanels = ['@ohif/extension-webquiz.panelModule.webquiz'];
          if (userRole === 'admin') {
                // rightPanels = [ '@ohif/extension-webquiz.panelModule.webquiz', cornerstone.segLabelMap, cornerstone.segContour];
            rightPanels = [ '@ohif/extension-webquiz.panelModule.webquiz',
              cornerstone.labelMapSegmentationPanel,
              // cornerstone.contourSegmentationPanel,
            ]
          }
          return {
            id: ohif.layout,
            props: {
              // leftPanels: [ ohif.thumbnailList],
              leftPanels:  ['@ohif/extension-webquiz.panelModule.seriesList'],
              leftPanelResizable: true,
              rightPanels,
              rightPanelResizable: false,
              viewports: [
                {
                  namespace: cornerstone.viewport,
                  displaySetsToDisplay: [ohif.sopClassHandler],
                },
                {
                  namespace: segmentation.viewport,
                  displaySetsToDisplay: [segmentation.sopClassHandler],
                },
                {
                  namespace: dicomRT.viewport,
                  displaySetsToDisplay: [dicomRT.sopClassHandler],
                },
              ],
            },
          };
        },
      },
    ],  //routes
    
    extensions: extensionDependencies,
    /** HangingProtocol used by the mode */
    hangingProtocol: ['default'],
    /** SopClassHandlers used by the mode */
    sopClassHandlers: [ohif.sopClassHandler, segmentation.sopClassHandler, dicomRT.sopClassHandler],
  } //return
};  //mode factory

const mode = {
  id,
  modeFactory,
  extensionDependencies,
};

export default mode;