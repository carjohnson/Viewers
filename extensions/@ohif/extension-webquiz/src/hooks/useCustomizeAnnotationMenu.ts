import React, { useEffect, useState, useRef } from 'react';
import { useSystem } from '@ohif/core';


interface CustomizeAnnotationMenuProps {
  userInfo: { username: string; role: string };
  isStudyCompletedRef: React.MutableRefObject<boolean>;
  measurementService: any;
  showModal: (modalProps: {
    title: string;
    message: string;
    showCancel?: boolean;
    onCancel?: () => void;
  }) => void;
}


export default function useCustomizeAnnotationMenu({
  userInfo,
  isStudyCompletedRef,
  measurementService,
  showModal,

}: CustomizeAnnotationMenuProps) {

  const { servicesManager } = useSystem();
  const { customizationService } = servicesManager.services;

useEffect(() => {
  try {
    customizationService.setCustomizations({
      measurementsContextMenu: {
        $set: {
          inheritsFrom: 'ohif.contextMenu',
          menus: [
            {
              id: 'measurementMenu',
              selector: ({ nearbyToolData }) => !!nearbyToolData,
              items: [
                ...(isStudyCompletedRef?.current || userInfo?.role === 'admin'
                  ? [
                      {
                        id: 'locked',
                        label: 'Changes Disabled',
                        commands: () => {
                          const msg =
                            userInfo?.role === 'admin'
                              ? 'Admin not allowed to delete measurements or modify the labels.'
                              : 'Case is locked. No further changes allowed.';

                          showModal({
                            title: 'Changes Disabled',
                            message: msg,
                            showCancel: false,
                          });
                        },
                      },
                    ]
                  : [
                      {
                        id: 'delete',
                        label: 'Delete Measurement',
                        commands: ({ nearbyToolData }) => {
                          // nearbyToolData is the full measurement/annotation object
                          // console.log('Deleting annotation object:', nearbyToolData); // for debug
                          const annotationUID = nearbyToolData.annotationUID;

                          // Remove from MeasurementService (also fires MEASUREMENT_REMOVED internally)
                          measurementService.remove(annotationUID);                          
                        },
                      }
                    ]),
              ],
            },
          ],
        },
      },
    });
  } catch (err) {
    console.error('Error customizing annotation menu:', err);
    showModal({
      title: 'Customization Error',
      message: `An error occurred while setting up the annotation context menu: ${err instanceof Error ? err.message : String(err)}`,
      showCancel: false,
    });
  }
}, [userInfo, isStudyCompletedRef, measurementService, showModal]);
}
