import { isRunningInExpoGo, registerRootComponent } from 'expo';

// Resolve the root before importing App: Mapbox and Cashfree can throw during import
// when their native modules are absent. A React error boundary is too late.
const expoGo = isRunningInExpoGo();
if (!expoGo && require('./src/appVariant').isProfessionalApp) require('./src/lib/professionalLocation');
const App = expoGo
  ? require('./src/ExpoGoScreen').default
  : require('./App').default;

registerRootComponent(App);
