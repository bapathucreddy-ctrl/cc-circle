import { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Coordinate } from '../domain';
import { Button, IconButton, useTheme } from '../ui';
import { MapExperience } from './MapExperience';
import { AppFooter } from './AppFooter';

/** Location forms open the same immersive map instead of embedding a square map. */
export function MapLocationField({ center, onChooseLocation, label = 'Choose service area' }: {
  center: Coordinate; onChooseLocation: (point: Coordinate) => void; label?: string;
}) {
  const { colors, styles } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(center);
  return <>
    <Button title={label} secondary icon="pin" onPress={() => { setDraft(center); setOpen(true); }} />
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}><SafeAreaView style={{ flex: 1, backgroundColor: colors.panel }}>
      <MapExperience title="Confirm location" map={{ center: draft, centerIsLocation: true, onChooseLocation: setDraft }}
        top={<View style={{ alignItems: 'flex-start' }}><IconButton name="close" label="Close map without changes" onPress={() => setOpen(false)} /></View>}
        footer={<Button title="Use this location" onPress={() => { onChooseLocation(draft); setOpen(false); }} />}>
        <Text style={styles.text}>Tap the map to place your pin.</Text>
        <Text style={styles.muted}>{draft[1].toFixed(5)}, {draft[0].toFixed(5)}</Text>
        <AppFooter />
      </MapExperience>
    </SafeAreaView></Modal>
  </>;
}
