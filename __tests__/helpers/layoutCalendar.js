import { act } from 'react-test-renderer';
import { View } from 'react-native';

export async function layoutCalendar(tree, overrides = {}) {
  const frames = {
    controls: { x: 19.5, y: 83, width: 281, height: 36 },
    month: { x: 41, y: 0, width: 117, height: 36 },
    year: { x: 164, y: 0, width: 76, height: 36 },
    ...overrides,
  };
  await act(async () => {
    for (const [key, layout] of Object.entries(frames)) {
      const testID = key === 'controls' ? 'calendar-controls' : `calendar-${key}-anchor`;
      const matches = tree.root.findAllByProps({ testID });
      const node = matches.find(candidate => candidate.type === View) || matches[0];
      node.props.onLayout({ nativeEvent: { layout } });
    }
  });
}
