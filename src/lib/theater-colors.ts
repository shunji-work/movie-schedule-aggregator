export const getTheaterChainColor = (chain: string): string => {
  const chainLower = chain.toLowerCase();

  if (chainLower.includes('toho') || chainLower.includes('tohoシネマズ')) {
    return 'bg-red-600';
  }

  if (chainLower.includes('ユナイテッド') || chainLower.includes('united')) {
    return 'bg-orange-500';
  }

  if (chainLower.includes('109') || chainLower.includes('シネマズ109')) {
    return 'bg-yellow-400';
  }

  if (chainLower.includes('イオン') || chainLower.includes('aeon')) {
    return 'bg-pink-700';
  }

  if (chainLower.includes('movix') || chainLower.includes('ピカデリー') || chainLower.includes('picadilly')) {
    return 'bg-blue-500';
  }

  if (chainLower.includes('humax') || chainLower.includes('ヒューマックス')) {
    return 'bg-green-600';
  }

  return 'bg-gray-500';
};

export const getTheaterChainTextColor = (): string => {
  return 'text-white';
};

export const getTheaterChainBorderColor = (chain: string): string => {
  const chainLower = chain.toLowerCase();

  if (chainLower.includes('toho') || chainLower.includes('tohoシネマズ')) {
    return 'border-red-600';
  }

  if (chainLower.includes('ユナイテッド') || chainLower.includes('united')) {
    return 'border-orange-500';
  }

  if (chainLower.includes('109') || chainLower.includes('シネマズ109')) {
    return 'border-yellow-400';
  }

  if (chainLower.includes('イオン') || chainLower.includes('aeon')) {
    return 'border-pink-700';
  }

  if (chainLower.includes('movix') || chainLower.includes('ピカデリー') || chainLower.includes('picadilly')) {
    return 'border-blue-500';
  }

  if (chainLower.includes('humax') || chainLower.includes('ヒューマックス')) {
    return 'border-green-600';
  }

  return 'border-gray-500';
};
