export const getTheaterChainColor = (chain: string): string => {
  const normalized = chain.toLowerCase();

  if (normalized.includes('toho')) {
    return 'bg-red-600';
  }

  if (normalized.includes('united')) {
    return 'bg-orange-500';
  }

  if (normalized.includes('109')) {
    return 'bg-amber-500';
  }

  if (normalized.includes('aeon')) {
    return 'bg-pink-600';
  }

  if (normalized.includes('movix') || normalized.includes('piccadilly')) {
    return 'bg-blue-600';
  }

  if (normalized.includes('humax')) {
    return 'bg-emerald-600';
  }

  return 'bg-slate-600';
};

export const getTheaterChainBorderColor = (chain: string): string => {
  const normalized = chain.toLowerCase();

  if (normalized.includes('toho')) {
    return 'border-red-600';
  }

  if (normalized.includes('united')) {
    return 'border-orange-500';
  }

  if (normalized.includes('109')) {
    return 'border-amber-500';
  }

  if (normalized.includes('aeon')) {
    return 'border-pink-600';
  }

  if (normalized.includes('movix') || normalized.includes('piccadilly')) {
    return 'border-blue-600';
  }

  if (normalized.includes('humax')) {
    return 'border-emerald-600';
  }

  return 'border-slate-600';
};
