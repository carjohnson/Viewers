import { useEffect, useState, useRef, useCallback } from 'react';


export function useActiveViewportId(
  viewportGridService: any,
  annotationsLoaded: boolean,
  cornerstoneViewportService: any,
) {
  const [activeViewportId, setActiveViewportId] = useState<string | null>(null);
  const activeViewportIdRef = useRef<string | null>(null);
  const activeViewportElementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!viewportGridService) {
      console.log('[useActiveViewportId] skipping, viewport not defined? ... :', viewportGridService);
      return;
    }
    if (!annotationsLoaded) {
      console.log('[useActiveViewportId] skipping, annotations not loaded');
      return;
    }

    const initialId = viewportGridService.getActiveViewportId();
    setActiveViewportId(initialId);
    activeViewportIdRef.current = initialId;
    // console.log('🔎 [useActiveViewportId] initial:', initialId);

    const id = activeViewportIdRef.current;
    const viewportInfo = cornerstoneViewportService.getViewportInfo(id);
    // console.log(' *** IN HOOK TO GET ELEMENT... viewportInfo', viewportInfo);

    
    if (!viewportInfo) {
      console.log('⚠️ [useActiveViewportElement] no viewportInfo for ID:', id);
      activeViewportElementRef.current = null;
      return;
    }

    const el = viewportInfo.getElement?.() ?? viewportInfo.element ?? null;
    activeViewportElementRef.current = el;
    console.log('✅ [useActiveViewportElement] element set for ID:', id, el);





    const subscription = viewportGridService.subscribe(
      viewportGridService.EVENTS.ACTIVE_VIEWPORT_ID_CHANGED,
      (evt: { viewportId: string }) => {
        setActiveViewportId(evt.viewportId);
        activeViewportIdRef.current = evt.viewportId;
        console.log('🔄 [useActiveViewportId] changed:', evt.viewportId);
      }
    );



    return () => subscription.unsubscribe();
  }, [viewportGridService, annotationsLoaded]);

  return { activeViewportId, activeViewportIdRef, activeViewportElementRef };
}
