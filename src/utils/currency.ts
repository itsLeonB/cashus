export const formatCurrency = (amount: number | string): string => {
  const currencyCode = import.meta.env.VITE_CURRENCY_CODE || 'IDR';
  const currencySymbol = import.meta.env.VITE_CURRENCY_SYMBOL || 'Rp';

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount) || !Number.isFinite(numAmount)) {
    return `${currencySymbol} 0`;
  }

  if (currencyCode === 'IDR') {
    // Indonesian Rupiah formatting - no decimals, use dots for thousands separator
    return `${currencySymbol} ${numAmount.toLocaleString('id-ID')}`;
  }

  // Default formatting for other currencies
  return `${currencySymbol} ${numAmount.toLocaleString()}`;
};

export const getCurrencySymbol = (): string => {
  return import.meta.env.VITE_CURRENCY_SYMBOL || 'Rp';
};

export const getCurrencyCode = (): string => {
  return import.meta.env.VITE_CURRENCY_CODE || 'IDR';
};
