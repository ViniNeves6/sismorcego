import {
  getSpotlightRect, getSpotlightScrollY, getSpotlightPanelTop, spotlightPaths,
  getSpotlightOverviewRect, getSpotlightAnchorScrollY,
} from '../src/ui/spotlightLayout';

test('focus follows the real control relative to the overlay, including the status bar inset', () => {
  const control = { x: 20, y: 126, width: 320, height: 128 };
  const frame = { x: 0, y: 24, width: 360, height: 760 };
  expect(getSpotlightRect(control, frame)).toEqual({ x: 15, y: 97, width: 330, height: 138 });
  // Moving the app window must leave the focus at the same place inside it.
  expect(getSpotlightRect({ ...control, x: 60, y: 196 }, { ...frame, x: 40, y: 94 }))
    .toEqual(getSpotlightRect(control, frame));
});

test('scrolling reveals the entire field above the dock and stays stable after remeasurement', () => {
  const viewport = { y: 100, height: 600 };
  const field = { y: 680, height: 48 };
  const nextOffset = getSpotlightScrollY(field, viewport, 120, 630);
  expect(nextOffset).toBe(242);
  const scrolledField = { ...field, y: field.y - (nextOffset - 120) };
  expect(scrolledField.y + scrolledField.height).toBe(606);
  expect(getSpotlightScrollY(scrolledField, viewport, nextOffset, 630)).toBe(nextOffset);
  // Returning to an earlier target scrolls upward as well.
  expect(getSpotlightScrollY({ y: 60, height: 40 }, viewport, 242, 630)).toBe(188);
  expect(getSpotlightScrollY({ y: 102, height: 40 }, viewport, 0, 630)).toBe(0);
});

test('panel placement uses its actual height and switches above a low target', () => {
  expect(getSpotlightPanelTop({ y: 100, height: 120 }, 760, 200)).toBe(236);
  expect(getSpotlightPanelTop({ y: 600, height: 60 }, 760, 200)).toBe(384);
  expect(getSpotlightPanelTop({ y: 100, height: 120 }, 760, 600)).toBe(148);
  expect(getSpotlightPanelTop({ y: 7, height: 650 }, 760, 200, true)).toBe(548);
  // Leave the HTML's 12px bottom margin, even if a card would fit without it.
  expect(getSpotlightPanelTop({ y: 520, height: 30 }, 760, 200)).toBe(304);
});

test('overview reveals the visible screen without extending into the bottom navigation', () => {
  const frame = { x: 0, y: 24, width: 360, height: 760 };
  expect(getSpotlightOverviewRect(frame, frame, 700)).toEqual({ x: 7, y: 7, width: 346, height: 664 });
});

test('scroll anchors align sections below the header and clamp at the end of actual content', () => {
  const viewport = { y: 100, height: 600 };
  expect(getSpotlightAnchorScrollY({ y: 650 }, viewport, 0, 1600, 18)).toBe(532);
  expect(getSpotlightAnchorScrollY({ y: 1150 }, viewport, 200, 1600, 18)).toBe(1000);
  expect(getSpotlightAnchorScrollY({ y: 60 }, viewport, 0)).toBe(0);
});

test('temporary guide scroll room lets a final chart move separately from the preceding map', () => {
  const viewport = { y: 100, height: 800 };
  const map = { y: 600 };
  const chart = { y: 1000 };
  expect(getSpotlightAnchorScrollY(map, viewport, 0, 1160, 18)).toBe(360);
  expect(getSpotlightAnchorScrollY(chart, viewport, 0, 1160, 18)).toBe(360);
  expect(getSpotlightAnchorScrollY(map, viewport, 0, 1960, 18)).toBe(482);
  expect(getSpotlightAnchorScrollY(chart, viewport, 0, 1960, 18)).toBe(882);
});

test('the transparent hole has the HTML corner radius, including smaller controls', () => {
  const paths = spotlightPaths({ x: 15, y: 97, width: 330, height: 138 }, { width: 360, height: 760 });
  expect(paths.shade).toContain('A 18 18');
  expect(paths.shade).toContain('M 0 0 H 360 V 760 H 0 Z');
  expect(paths.glow).toContain('A 20 20');
  expect(paths.glow).toContain('A 18 18');
  expect(paths.border).toContain('A 14 14');
  expect(spotlightPaths({ x: 150, y: 680, width: 60, height: 60 }, { width: 360, height: 760 }).shade).toContain('A 12 12');
});
