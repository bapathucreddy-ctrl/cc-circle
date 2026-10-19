import { Image, Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { appVariant } from './appVariant';

export default function ExpoGoScreen() {
  return <ScrollView contentContainerStyle={styles.page}>
    <Image accessibilityLabel="Circle logo" source={require('../assets/brand/mark-white.png')} style={{ width: 72, height: 72 }} resizeMode="contain" />
    <Text style={styles.title}>Open the Circle development app.</Text>
    <Text style={styles.text}>This project uses native Mapbox maps and Cashfree payments. Expo Go does not include those modules. Install its development build to use the full app.</Text>
    <Text style={styles.text}>1. Build and install the {appVariant} development app on your phone.</Text>
    <Text style={styles.text}>2. From the mobile folder on your computer, run:</Text>
    <Text selectable style={styles.command}>{`.\\run-device.cmd ${appVariant}`}</Text>
    <Text style={styles.text}>3. Open the installed Circle app and connect to that development server. Keep the phone and computer on the same Wi-Fi.</Text>
    <Text style={styles.text}>Build instructions are in docs/native-development.md in this project.</Text>
    <Pressable accessibilityRole="link" accessibilityLabel="Read Expo development build guide" onPress={() => { void Linking.openURL('https://docs.expo.dev/develop/development-builds/introduction/'); }} style={styles.button}><Text style={styles.buttonText}>Development build guide</Text></Pressable>
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', padding: 28, paddingTop: 64, paddingBottom: 48, gap: 20, backgroundColor: '#282828' },
  title: { color: '#ffffff', fontSize: 28, lineHeight: 34, fontWeight: '700' },
  text: { color: '#dddddd', fontSize: 15, lineHeight: 24 },
  command: { backgroundColor: '#101010', color: '#ffffff', padding: 16, borderRadius: 12, fontSize: 14 },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 14, borderRadius: 24, borderWidth: 1, borderColor: '#b3b3b3', backgroundColor: '#000000' },
  buttonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});
