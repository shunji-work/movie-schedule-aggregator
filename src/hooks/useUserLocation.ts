import { useEffect, useState } from 'react';
import {
  getCurrentLocation,
  getMockLocation,
  type Location,
} from '@/lib/geolocation';

type LocationStatus = 'detecting' | 'live' | 'fallback';

export function useUserLocation() {
  const [location, setLocation] = useState<Location>(getMockLocation());
  const [status, setStatus] = useState<LocationStatus>('detecting');

  useEffect(() => {
    let cancelled = false;

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

        setLocation(getMockLocation());
        setStatus('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    location,
    status,
    isFallback: status !== 'live',
  };
}
