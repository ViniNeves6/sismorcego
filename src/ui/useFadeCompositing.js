import { useEffect, useMemo, useState } from 'react';

// Cache the whole alpha group before entry/exit starts, then release the native
// texture at the endpoint. Elevated descendants and their faces must be drawn
// into the same Android texture before alpha is applied.
export default function useFadeCompositing(progress, target, reduceMotion = false, transitionKey = target) {
  const request = useMemo(() => ({ target, transitionKey, progress }), [target, transitionKey, progress]);
  const [settledRequest, setSettledRequest] = useState(null);

  useEffect(() => {
    if (reduceMotion) { setSettledRequest(request); return; }
    let active = true;
    let settled;
    const listener = progress.addListener(({ value }) => {
      if (!active) return;
      const nextSettled = value === request.target;
      if (settled !== nextSettled) {
        settled = nextSettled;
        setSettledRequest(nextSettled ? request : null);
      }
    });
    return () => { active = false; progress.removeListener(listener); };
  }, [progress, request, reduceMotion]);

  return {
    collapsable: false,
    needsOffscreenAlphaCompositing: true,
    renderToHardwareTextureAndroid: !reduceMotion && settledRequest !== request,
  };
}
