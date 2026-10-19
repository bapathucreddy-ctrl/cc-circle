import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { bengaluru, errorText, type Coordinate } from './domain';
import { currentLocation } from './lib/currentLocation';
import { coordinateLocationLabel, deviceLocationLabel, type DeviceLocationSource } from './lib/deviceLocation';

export function useInitialDeviceLocation() {
  const [center, setCenter] = useState<Coordinate>(bengaluru);
  const [label, setLabel] = useState('Finding your location…');
  const [error, setError] = useState('');
  const version = useRef(0);
  const manuallySelected = useRef(false);
  const changeLocation = useCallback((point: Coordinate, name: string, source: DeviceLocationSource = 'manual') => {
    manuallySelected.current = source !== 'gps'; version.current++; setCenter(point); setLabel(name); setError('');
  }, []);
  useEffect(() => {
    let active = true;
    let locating = false;
    let controller: AbortController | undefined;
    async function locate() {
      if (locating || manuallySelected.current) return;
      locating = true;
      const revision = ++version.current;
      controller?.abort(); controller = new AbortController();
      try {
        const fix = await currentLocation();
        if (!active || revision !== version.current) return;
        const point: Coordinate = [fix.coords.longitude, fix.coords.latitude];
        // Move immediately; resolving the address must not delay GPS centering.
        setCenter(point); setLabel(coordinateLocationLabel(point, fix.coords.accuracy));
        const address = await deviceLocationLabel(point, fix.coords.accuracy, controller.signal);
        if (active && revision === version.current) { setLabel(address); setError(''); }
      } catch (e) {
        if (active && revision === version.current) { setLabel('Choose your location'); setError(errorText(e)); }
      } finally { locating = false; }
    }
    void locate();
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')void locate();});
    return () => { active = false; controller?.abort(); subscription.remove(); };
  }, []);
  return { center, label, error, changeLocation };
}
