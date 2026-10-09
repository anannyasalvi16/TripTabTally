import type { Paise } from './types';

export interface FormatOptions {
  includeSymbol?: boolean;
  showZeroDecimals?: boolean;
}

/**
 * Formats integer paise into Indian currency grouping string.
 * Example: 12345678 paise -> "₹1,23,456.78"
 * Example: 10000 paise with showZeroDecimals: false -> "₹100"
 */
export function formatPaise(paise: Paise, options: FormatOptions = {}): string {
  const { includeSymbol = true, showZeroDecimals = true } = options;

  const isNegative = paise < 0;
  const absPaise = Math.abs(Math.round(paise));

  const wholeRupees = Math.floor(absPaise / 100);
  const remainderPaise = absPaise % 100;

  // Format whole rupees in Indian grouping (3 digits on right, pairs of 2 on left)
  const rupeesStr = wholeRupees.toString();
  let formattedRupees = '';

  if (rupeesStr.length <= 3) {
    formattedRupees = rupeesStr;
  } else {
    const lastThree = rupeesStr.slice(-3);
    const rest = rupeesStr.slice(0, -3);

    // Group the rest in chunks of 2 from right to left
    const restGrouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedRupees = `${restGrouped},${lastThree}`;
  }

  // Handle decimals
  let decimalsStr = '';
  if (remainderPaise > 0 || showZeroDecimals) {
    decimalsStr = `.${remainderPaise.toString().padStart(2, '0')}`;
  }

  const prefix = isNegative ? '-' : '';
  const symbol = includeSymbol ? '₹' : '';

  return `${prefix}${symbol}${formattedRupees}${decimalsStr}`;
}
