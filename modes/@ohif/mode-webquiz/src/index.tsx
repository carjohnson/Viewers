import i18n from 'i18next';
import { id } from './id';
import initToolGroups from './initToolGroups';
import toolbarButtons from './toolbarButtons';
import { hotkeys } from '@ohif/core';

const configs = {
  Length: {},
  //
};
const ohif = {
  layout: '@ohif/extension-default.layoutTemplateModule.viewerLayout',
  sopClassHandler: '@ohif/extension-default.sopClassHandlerModule.stack',
  thumbnailList: '@ohif/extension-default.panelModule.seriesList',
  hangingProtocol: '@ohif/extension-default.hangingProtocolModule.default',
};

const cornerstone = {
  measurements: '@ohif/extension-cornerstone.panelModule.panelMeasurement',
  segmentation: '@ohif/extension-cornerstone.panelModule.panelSegmentationWithTools',
  viewport: '@ohif/extension-cornerstone.viewportModule.cornerstone',
};

const segmentation = {
  sopClassHandler: '@ohif/extension-cornerstone-dicom-seg.sopClassHandlerModule.dicom-seg',
  viewport: '@ohif/extension-cornerstone-dicom-seg.viewportModule.dicom-seg',
};

const dicomRT = {
  viewport: '@ohif/extension-cornerstone-dicom-rt.viewportModule.dicom-rt',
  sopClassHandler: '@ohif/extension-cornerstone-dicom-rt.sopClassHandlerModule.dicom-rt',
};

const extensionDependencies = {
  '@ohif/extension-default': '^3.0.0',
  '@ohif/extension-cornerstone': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-seg': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-rt': '^3.0.0',
  '@ohif/extension-webquiz': '^0.0.1',
};

function modeFactory({ modeConfiguration }) {
  return {
    id,
    routeName: 'webquiz',
    displayName: 'Liver Study',

    onModeEnter:({servicesManager, extensionManager, commandsManager }: withAppTypes) => {

      const { measurementService, toolbarService, toolGroupService, customizationService } =
        servicesManager.services;

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
        'Bidirectional',
        'ArrowAnnotate',
        'EllipticalROI',
        'RectangleROI',
        'CircleROI',
        'PlanarFreehandROI',
        'SplineROI',
        'LivewireContour',
      ]);

      toolbarService.updateSection('MoreTools', [
        'Reset',
        'rotate-right',
        'flipHorizontal',
        'ImageSliceSync',
        'ReferenceLines',
        'ImageOverlayViewer',
        'StackScroll',
        'invert',
        'Probe',
        'Cine',
        'Angle',
        'CobbAngle',
        'Magnify',
        'CalibrationLine',
        'TagBrowser',
        'AdvancedMagnify',
        'UltrasoundDirectionalTool',
        'WindowLevelRegion',
      ]);

      customizationService.setCustomizations({
        'panelSegmentation.disableEditing': {
          $set: false,
        },
      });

      // segmentation tools
      toolbarService.updateSection(toolbarService.sections.segmentationToolbox, [
        'SegmentationUtilities',
        'SegmentationTools',
      ]);
      toolbarService.updateSection('SegmentationUtilities', [
        'LabelmapSlicePropagation',
        'InterpolateLabelmap',
        'SegmentBidirectional',
      ]);
      toolbarService.updateSection('SegmentationTools', [
        'BrushTools',
        'MarkerLabelmap',
        'RegionSegmentPlus',
        'Shapes',
      ]);
      toolbarService.updateSection('BrushTools', ['Brush', 'Eraser', 'Threshold']);

      //=============================
      //Primary tools are based on the user's role
      //  - admins are not allowed to add or change annotations created by the MeasurementTools

      // Send request to parent to get the user info
      window.parent.postMessage({ type: 'request-user-info' }, '*');

      // Listen for response
      const handleMessage = event => {
        if (event.data.type === 'user-info') {
          const userInfo = event.data.payload;
          console.log('✅ Mode > Received user info:', userInfo);

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

          // Clean up listener
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);
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
          return {
            id: ohif.layout,
            props: {
              leftPanels: [ ohif.thumbnailList],
              leftPanelResizable: true,
              rightPanels: [ '@ohif/extension-webquiz.panelModule.webquiz', cornerstone.segmentation, cornerstone.measurements ],
              rightPanelResizable: true,
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
                },              ],
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