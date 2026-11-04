import { act } from 'react-test-renderer';
import { View } from 'react-native';

export async function layoutRecordDetails(tree) {
  const dialog = tree.root.findAllByProps({ testID: 'record-details-dialog' }).find(node => node.type === View);
  if (dialog) await act(async () => dialog.props.onLayout({ nativeEvent: { layout: { x: 20, y: 80, width: 320, height: 560 } } }));
}
