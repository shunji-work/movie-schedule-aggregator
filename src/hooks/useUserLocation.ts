import { useEffect, useState } from 'react';
import {
  getCurrentLocation,
  getLocationPreference,
  getStationById,
  LOCATION_PREFERENCE_EVENT,
  type Location,
  type LocationPreference,
  type StationLocation,
} from '@/lib/geolocation';

type LocationStatus = 'detecting' | 'live' | 'station' | 'fallback';

export function useUserLocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [status, setStatus] = useState<LocationStatus>('detecting');
  const [preference, setPreference] = useState<LocationPreference>(() =>
    getLocationPreference()
  );
  const [station, setStation] = useState<StationLocation>(() =>
    getStationById(preference.stationId)
  );

  useEffect(() => {
    const handlePreferenceChange = () => {
      setPreference(getLocationPreference());
    };

    window.addEventListener(LOCATION_PREFERENCE_EVENT, handlePreferenceChange);
    window.addEventListener('storage', handlePreferenceChange);

    return () => {
      window.removeEventListener(LOCATION_PREFERENCE_EVENT, handlePreferenceChange);
      window.removeEventListener('storage', handlePreferenceChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const selectedStation = getStationById(preference.stationId);

    setStation(selectedStation);

    if (preference.mode === 'station') {
      setLocation(selectedStation);
      setStatus('station');
      return () => {
        cancelled = true;
      };
    }

    setStatus('detecting');

    getCurrentLocation()
      .then((nextLocation) => {
        if (cancelled) {
          return;
        }

        setLocation(nextLocation);
        setStatus('live');
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setLocation(selectedStation);
        setStatus('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, [preference]);

  return {
    location,
    status,
    station,
    mode: preference.mode,
    sourceLabel: status === 'live' ? '現在地' : station.name,
    isFallback: status === 'fallback',
  };
}
