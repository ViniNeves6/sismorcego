import { useEffect, useState } from 'react';
import { initialDevicePerformance, loadDevicePerformance } from '../services/devicePerformance';

export default function useDevicePerformance() {
  const [profile, setProfile] = useState(initialDevicePerformance);
  useEffect(() => {
    let active = true;
    loadDevicePerformance().then(next => { if (active) setProfile(next); });
    return () => { active = false; };
  }, []);
  return profile;
}
