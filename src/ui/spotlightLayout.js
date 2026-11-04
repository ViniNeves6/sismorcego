// All rectangles use the same native window coordinates, including the overlay.
export function getSpotlightRect(target, frame) {
  const x = Math.max(7, target.x - frame.x - 5);
  const y = Math.max(7, target.y - frame.y - 5);
  return {
    x,
    y,
    width: Math.max(12, Math.min(target.width + 10, frame.width - x - 7)),
    height: Math.max(12, Math.min(target.height + 10, frame.height - y - 7)),
  };
}

export function getSpotlightOverviewRect(target, frame, dockTop = Infinity) {
  const rect = getSpotlightRect(target, frame);
  const bottom = Math.min(frame.height - 7, dockTop - frame.y - 5);
  return { ...rect, height: Math.max(12, Math.min(rect.height, bottom - rect.y)) };
}

export function getSpotlightPanelTop(rect, frameHeight, panelHeight, overview = false) {
  const below = rect.y + rect.height + 16;
  const above = rect.y - panelHeight - 16;
  const maxTop = frameHeight - panelHeight - 12;
  const candidates = [12, maxTop, Math.max(12, Math.min(below, maxTop))];
  const overlap = top => Math.max(0, Math.min(top + panelHeight, rect.y + rect.height) - Math.max(top, rect.y));
  const top = overview ? maxTop : below + panelHeight <= frameHeight - 12 ? below
    : above >= 12 ? above
    : candidates.reduce((best, candidate) => overlap(candidate) < overlap(best) ? candidate : best, candidates[0]);
  return Math.max(12, Math.min(top, maxTop));
}

export function getSpotlightAnchorScrollY(target, viewport, offset, contentHeight = Infinity, gap = 16) {
  const maxOffset = Math.max(0, contentHeight - viewport.height);
  return Math.max(0, Math.min(maxOffset, offset + target.y - viewport.y - gap));
}

export function getSpotlightScrollY(target, viewport, offset, dockTop = Infinity) {
  const upper = viewport.y + 14;
  const lower = Math.min(viewport.y + viewport.height, dockTop) - 24;
  let delta = 0;
  if (target.height > lower - upper || target.y < upper) delta = target.y - upper;
  else if (target.y + target.height > lower) delta = target.y + target.height - lower;
  return Math.max(0, offset + delta);
}

export function roundedSpotlightPath(rect, radius = Math.min(18, rect.height / 5)) {
  const { x, y, width, height } = rect;
  const r = Math.min(radius, width / 2, height / 2);
  const right = x + width;
  const bottom = y + height;
  return `M ${x + r} ${y} H ${right - r} A ${r} ${r} 0 0 1 ${right} ${y + r} V ${bottom - r} A ${r} ${r} 0 0 1 ${right - r} ${bottom} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${bottom - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
}

export function spotlightPaths(rect, frame) {
  const hole = roundedSpotlightPath(rect);
  return {
    shade: `M 0 0 H ${frame.width} V ${frame.height} H 0 Z ${hole}`,
    glow: `${roundedSpotlightPath({ x: rect.x - 5, y: rect.y - 5, width: rect.width + 10, height: rect.height + 10 }, 20)} ${hole}`,
    border: roundedSpotlightPath({ x: rect.x + 1, y: rect.y + 1, width: rect.width - 2, height: rect.height - 2 }, 14),
  };
}

export function measureSpotlightNode(node) {
  return new Promise(resolve => {
    if (!node?.measureInWindow) return resolve(null);
    node.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}
