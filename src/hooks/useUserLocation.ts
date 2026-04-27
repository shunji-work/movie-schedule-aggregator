import { useEffect, useState } from 'react';
import { getCurrentLocation, type Location } from '@/lib/geolocation';

type LocationStatus = 'detecting' | 'live' | 'fallback';

export function useUserLocation() {
  const [location, setLocation] = useState<Location | null>(null);
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

        setStatus('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    location,
    status,
    isFallback: status === 'fallback',
  };
}
