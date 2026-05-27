import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Crosshair, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  getLocationPreference,
  getStationById,
  LOCATION_PREFERENCE_EVENT,
  setLocationPreference,
  STATIONS,
  type LocationMode,
  type LocationPreference,
} from '@/lib/geolocation';
import { cn } from '@/lib/utils';

const STATION_AREAS = [...new Set(STATIONS.map((station) => station.area))];

export function LocationModeControl() {
  const [preference, setPreferenceState] = useState<LocationPreference>(() =>
    getLocationPreference()
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const syncPreference = () => {
      setPreferenceState(getLocationPreference());
    };

    window.addEventListener(LOCATION_PREFERENCE_EVENT, syncPreference);
    window.addEventListener('storage', syncPreference);

    return () => {
      window.removeEventListener(LOCATION_PREFERENCE_EVENT, syncPreference);
      window.removeEventListener('storage', syncPreference);
    };
  }, []);

  const updatePreference = (nextPreference: LocationPreference) => {
    setPreferenceState(nextPreference);
    setLocationPreference(nextPreference);
  };

  const handleModeChange = (mode: LocationMode) => {
    updatePreference({
      ...preference,
      mode,
    });
  };

  const handleStationChange = (stationId: string) => {
    updatePreference({
      mode: 'station',
      stationId: getStationById(stationId).id,
    });
    setOpen(false);
  };

  const selectedStation = getStationById(preference.stationId);

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm md:w-auto">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
        <MapPin className="h-3.5 w-3.5" />
        基準地点
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex rounded-lg bg-white p-1 ring-1 ring-slate-200">
          <Button
            type="button"
            size="sm"
            variant={preference.mode === 'current' ? 'default' : 'ghost'}
            className="h-8 flex-1 px-3 sm:flex-none"
            onClick={() => handleModeChange('current')}
          >
            <Crosshair className="mr-1.5 h-4 w-4" />
            現在地
          </Button>
          <Button
            type="button"
            size="sm"
            variant={preference.mode === 'station' ? 'default' : 'ghost'}
            className="h-8 flex-1 px-3 sm:flex-none"
            onClick={() => handleModeChange('station')}
          >
            <MapPin className="mr-1.5 h-4 w-4" />
            駅
          </Button>
        </div>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-10 justify-between bg-white sm:w-64"
            >
              <span className="truncate">
                {selectedStation.area} ・ {selectedStation.name}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(92vw,360px)] p-0" align="end">
            <Command>
              <CommandInput placeholder="駅名・地域で検索" />
              <CommandList className="max-h-80">
                <CommandEmpty>該当する駅がありません。</CommandEmpty>
                {STATION_AREAS.map((area) => (
                  <CommandGroup key={area} heading={area}>
                    {STATIONS.filter((station) => station.area === area).map((station) => (
                      <CommandItem
                        key={station.id}
                        value={`${station.area} ${station.name}`}
                        onSelect={() => handleStationChange(station.id)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            preference.stationId === station.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <span>{station.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
