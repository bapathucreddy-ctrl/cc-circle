import { useState } from 'react';
import { Modal, Platform, View } from 'react-native';
import NativeDateTimePicker, { type DateTimePickerEvent, type IOSNativeProps } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, useTheme } from '../ui';

export default function DateTimePicker(props: Pick<IOSNativeProps, 'value' | 'mode' | 'minimumDate' | 'maximumDate' | 'onChange'>) {
  const [draft, setDraft] = useState(props.value);
  const { colors, mode } = useTheme();
  if (Platform.OS !== 'ios') return <NativeDateTimePicker {...props} />;
  const finish = (accepted: boolean) => {
    const date = accepted ? draft : props.value;
    const event: DateTimePickerEvent = { type: accepted ? 'set' : 'dismissed', nativeEvent: { timestamp: date.getTime(), utcOffset: -date.getTimezoneOffset() } };
    props.onChange?.(event, accepted ? date : undefined);
  };
  return <Modal transparent visible animationType="slide" presentationStyle="overFullScreen" onRequestClose={() => finish(false)}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.panel, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
        <NativeDateTimePicker {...props} value={draft} display={props.mode === 'time' ? 'spinner' : 'inline'} themeVariant={mode} textColor={colors.text} onChange={(_, value) => { if (value) setDraft(value); }} />
        <View style={{ flexDirection: 'row', gap: 12 }}><Button title="Cancel" secondary onPress={() => finish(false)} /><Button title="Done" onPress={() => finish(true)} /></View>
      </SafeAreaView>
    </View>
  </Modal>;
}
