export type Location = {
  latitude: number;
  longitude: number;
};

export type LocationMode = 'current' | 'station';

export type StationLocation = Location & {
  id: string;
  name: string;
  area: string;
};

const LOCATION_MODE_KEY = 'movie-schedule.location-mode';
const STATION_ID_KEY = 'movie-schedule.station-id';
export const LOCATION_PREFERENCE_EVENT = 'movie-schedule.location-preference-change';

export const STATIONS: StationLocation[] = [
  { id: 'tokyo', name: '東京駅', area: '東京', latitude: 35.681236, longitude: 139.767125 },
  { id: 'yurakucho', name: '有楽町駅', area: '東京', latitude: 35.675069, longitude: 139.763328 },
  { id: 'ginza', name: '銀座駅', area: '東京', latitude: 35.671989, longitude: 139.763965 },
  { id: 'akihabara', name: '秋葉原駅', area: '東京', latitude: 35.698353, longitude: 139.773114 },
  { id: 'shinjuku', name: '新宿駅', area: '東京', latitude: 35.689592, longitude: 139.700413 },
  { id: 'shibuya', name: '渋谷駅', area: '東京', latitude: 35.658034, longitude: 139.701636 },
  { id: 'ikebukuro', name: '池袋駅', area: '東京', latitude: 35.728926, longitude: 139.71038 },
  { id: 'ueno', name: '上野駅', area: '東京', latitude: 35.713768, longitude: 139.777254 },
  { id: 'shinagawa', name: '品川駅', area: '東京', latitude: 35.628471, longitude: 139.73876 },
  { id: 'nihombashi', name: '日本橋駅', area: '東京', latitude: 35.682656, longitude: 139.774363 },
  { id: 'roppongi', name: '六本木駅', area: '東京', latitude: 35.662836, longitude: 139.731443 },
  { id: 'toyosu', name: '豊洲駅', area: '東京', latitude: 35.654908, longitude: 139.79621 },
  { id: 'kinshicho', name: '錦糸町駅', area: '東京', latitude: 35.696815, longitude: 139.81414 },
  { id: 'kitasenju', name: '北千住駅', area: '東京', latitude: 35.749565, longitude: 139.804686 },
  { id: 'kichijoji', name: '吉祥寺駅', area: '東京', latitude: 35.703119, longitude: 139.579765 },
  { id: 'tachikawa', name: '立川駅', area: '東京', latitude: 35.698202, longitude: 139.413704 },
  { id: 'machida', name: '町田駅', area: '東京', latitude: 35.542889, longitude: 139.445556 },
  { id: 'futako-tamagawa', name: '二子玉川駅', area: '東京', latitude: 35.611507, longitude: 139.626449 },
  { id: 'fuchu', name: '府中駅', area: '東京', latitude: 35.672285, longitude: 139.480123 },
  { id: 'nishiarai', name: '西新井駅', area: '東京', latitude: 35.777151, longitude: 139.79023 },
  { id: 'yokohama', name: '横浜駅', area: '神奈川', latitude: 35.465833, longitude: 139.622222 },
  { id: 'kawasaki', name: '川崎駅', area: '神奈川', latitude: 35.531248, longitude: 139.696716 },
  { id: 'sakuragicho', name: '桜木町駅', area: '神奈川', latitude: 35.450997, longitude: 139.631129 },
  { id: 'minatomirai', name: 'みなとみらい駅', area: '神奈川', latitude: 35.457151, longitude: 139.632843 },
  { id: 'musashi-kosugi', name: '武蔵小杉駅', area: '神奈川', latitude: 35.57665, longitude: 139.659489 },
  { id: 'shinyurigaoka', name: '新百合ヶ丘駅', area: '神奈川', latitude: 35.603986, longitude: 139.507683 },
  { id: 'ebina', name: '海老名駅', area: '神奈川', latitude: 35.452736, longitude: 139.390883 },
  { id: 'tsujido', name: '辻堂駅', area: '神奈川', latitude: 35.336748, longitude: 139.444327 },
  { id: 'chiba', name: '千葉駅', area: '千葉', latitude: 35.613425, longitude: 140.113653 },
  { id: 'funabashi', name: '船橋駅', area: '千葉', latitude: 35.701646, longitude: 139.985006 },
  { id: 'kashiwa', name: '柏駅', area: '千葉', latitude: 35.862223, longitude: 139.970818 },
  { id: 'kaihin-makuhari', name: '海浜幕張駅', area: '千葉', latitude: 35.648328, longitude: 140.041998 },
  { id: 'maihama', name: '舞浜駅', area: '千葉', latitude: 35.636036, longitude: 139.883482 },
  { id: 'omiya', name: '大宮駅', area: '埼玉', latitude: 35.906439, longitude: 139.623921 },
  { id: 'urawa', name: '浦和駅', area: '埼玉', latitude: 35.858496, longitude: 139.657536 },
  { id: 'saitama-shintoshin', name: 'さいたま新都心駅', area: '埼玉', latitude: 35.893777, longitude: 139.63358 },
  { id: 'kawagoe', name: '川越駅', area: '埼玉', latitude: 35.907737, longitude: 139.482771 },
  { id: 'koshigaya-laketown', name: '越谷レイクタウン駅', area: '埼玉', latitude: 35.876161, longitude: 139.822301 },
  { id: 'tokorozawa', name: '所沢駅', area: '埼玉', latitude: 35.786549, longitude: 139.473942 },
  { id: 'utsunomiya', name: '宇都宮駅', area: '栃木', latitude: 36.559246, longitude: 139.898389 },
  { id: 'takasaki', name: '高崎駅', area: '群馬', latitude: 36.322239, longitude: 139.012447 },
  { id: 'mito', name: '水戸駅', area: '茨城', latitude: 36.371241, longitude: 140.476636 },
  { id: 'tsukuba', name: 'つくば駅', area: '茨城', latitude: 36.082564, longitude: 140.110611 },
  { id: 'sapporo', name: '札幌駅', area: '北海道', latitude: 43.068612, longitude: 141.350768 },
  { id: 'susukino', name: 'すすきの駅', area: '北海道', latitude: 43.055461, longitude: 141.353548 },
  { id: 'shin-sapporo', name: '新札幌駅', area: '北海道', latitude: 43.038604, longitude: 141.472839 },
  { id: 'sendai', name: '仙台駅', area: '宮城', latitude: 38.260132, longitude: 140.882437 },
  { id: 'niigata', name: '新潟駅', area: '新潟', latitude: 37.912026, longitude: 139.061806 },
  { id: 'kanazawa', name: '金沢駅', area: '石川', latitude: 36.578057, longitude: 136.648659 },
  { id: 'toyama', name: '富山駅', area: '富山', latitude: 36.701997, longitude: 137.213648 },
  { id: 'nagano', name: '長野駅', area: '長野', latitude: 36.643307, longitude: 138.188635 },
  { id: 'matsumoto', name: '松本駅', area: '長野', latitude: 36.230937, longitude: 137.964044 },
  { id: 'shizuoka', name: '静岡駅', area: '静岡', latitude: 34.971736, longitude: 138.388949 },
  { id: 'hamamatsu', name: '浜松駅', area: '静岡', latitude: 34.70384, longitude: 137.734913 },
  { id: 'nagoya', name: '名古屋駅', area: '愛知', latitude: 35.170915, longitude: 136.881537 },
  { id: 'sakae', name: '栄駅', area: '愛知', latitude: 35.170924, longitude: 136.908066 },
  { id: 'kanayama', name: '金山駅', area: '愛知', latitude: 35.143922, longitude: 136.900645 },
  { id: 'toyota-shi', name: '豊田市駅', area: '愛知', latitude: 35.087203, longitude: 137.156152 },
  { id: 'gifu', name: '岐阜駅', area: '岐阜', latitude: 35.409951, longitude: 136.75666 },
  { id: 'kintetsu-yokkaichi', name: '近鉄四日市駅', area: '三重', latitude: 34.966955, longitude: 136.618929 },
  { id: 'osaka', name: '大阪駅（梅田）', area: '大阪', latitude: 34.702485, longitude: 135.495951 },
  { id: 'shin-osaka', name: '新大阪駅', area: '大阪', latitude: 34.73348, longitude: 135.500109 },
  { id: 'namba', name: 'なんば駅', area: '大阪', latitude: 34.666636, longitude: 135.500978 },
  { id: 'shinsaibashi', name: '心斎橋駅', area: '大阪', latitude: 34.675168, longitude: 135.500642 },
  { id: 'tennoji', name: '天王寺駅', area: '大阪', latitude: 34.646168, longitude: 135.513954 },
  { id: 'kyobashi-osaka', name: '京橋駅', area: '大阪', latitude: 34.697048, longitude: 135.532397 },
  { id: 'hirakatashi', name: '枚方市駅', area: '大阪', latitude: 34.816275, longitude: 135.648431 },
  { id: 'kyoto', name: '京都駅', area: '京都', latitude: 34.985849, longitude: 135.758766 },
  { id: 'shijo-karasuma', name: '四条烏丸駅', area: '京都', latitude: 35.003746, longitude: 135.759416 },
  { id: 'kyoto-kawaramachi', name: '京都河原町駅', area: '京都', latitude: 35.003835, longitude: 135.768328 },
  { id: 'sannomiya', name: '三宮駅', area: '兵庫', latitude: 34.69495, longitude: 135.195383 },
  { id: 'kobe', name: '神戸駅', area: '兵庫', latitude: 34.679456, longitude: 135.178221 },
  { id: 'nishinomiya-kitaguchi', name: '西宮北口駅', area: '兵庫', latitude: 34.745043, longitude: 135.356709 },
  { id: 'amagasaki', name: '尼崎駅', area: '兵庫', latitude: 34.73114, longitude: 135.431316 },
  { id: 'himeji', name: '姫路駅', area: '兵庫', latitude: 34.827489, longitude: 134.690347 },
  { id: 'kintetsu-nara', name: '近鉄奈良駅', area: '奈良', latitude: 34.684354, longitude: 135.827138 },
  { id: 'kusatsu', name: '草津駅', area: '滋賀', latitude: 35.022973, longitude: 135.962232 },
  { id: 'okayama', name: '岡山駅', area: '岡山', latitude: 34.66648, longitude: 133.918037 },
  { id: 'hiroshima', name: '広島駅', area: '広島', latitude: 34.397446, longitude: 132.475641 },
  { id: 'hatchobori-hiroshima', name: '八丁堀駅', area: '広島', latitude: 34.393893, longitude: 132.463761 },
  { id: 'takamatsu', name: '高松駅', area: '香川', latitude: 34.350428, longitude: 134.046707 },
  { id: 'matsuyama', name: '松山市駅', area: '愛媛', latitude: 33.835679, longitude: 132.762326 },
  { id: 'hakata', name: '博多駅', area: '福岡', latitude: 33.590355, longitude: 130.420673 },
  { id: 'tenjin', name: '天神駅', area: '福岡', latitude: 33.591357, longitude: 130.398727 },
  { id: 'kokura', name: '小倉駅', area: '福岡', latitude: 33.886917, longitude: 130.882989 },
  { id: 'kumamoto', name: '熊本駅', area: '熊本', latitude: 32.79021, longitude: 130.689957 },
  { id: 'kagoshima-chuo', name: '鹿児島中央駅', area: '鹿児島', latitude: 31.583974, longitude: 130.54121 },
  { id: 'nagasaki', name: '長崎駅', area: '長崎', latitude: 32.752812, longitude: 129.870802 },
  { id: 'omoromachi', name: 'おもろまち駅', area: '沖縄', latitude: 26.223127, longitude: 127.698352 },
  { id: 'kencho-mae-okinawa', name: '県庁前駅', area: '沖縄', latitude: 26.214454, longitude: 127.679141 },
];

export type LocationPreference = {
  mode: LocationMode;
  stationId: string;
};

export function getStationById(stationId: string): StationLocation {
  return STATIONS.find((station) => station.id === stationId) ?? STATIONS[0];
}

function notifyLocationPreferenceChange() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(LOCATION_PREFERENCE_EVENT));
}

export function getLocationPreference(): LocationPreference {
  if (typeof window === 'undefined') {
    return {
      mode: 'current',
      stationId: STATIONS[0].id,
    };
  }

  const mode = window.localStorage.getItem(LOCATION_MODE_KEY);
  const stationId = window.localStorage.getItem(STATION_ID_KEY);

  return {
    mode: mode === 'station' ? 'station' : 'current',
    stationId: getStationById(stationId || STATIONS[0].id).id,
  };
}

export function setLocationPreference(nextPreference: LocationPreference) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LOCATION_MODE_KEY, nextPreference.mode);
  window.localStorage.setItem(STATION_ID_KEY, getStationById(nextPreference.stationId).id);
  notifyLocationPreferenceChange();
}

export const calculateDistance = (
  from: Location,
  to: Location
): number => {
  const R = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  return d;
};

const toRad = (value: number): number => {
  return (value * Math.PI) / 180;
};

export const formatDistance = (km?: number | null): string => {
  if (typeof km !== 'number' || !Number.isFinite(km)) {
    return '距離不明';
  }

  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
};

export const getCurrentLocation = (): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  });
};

export const getMockLocation = (): Location => {
  return STATIONS[0];
};
