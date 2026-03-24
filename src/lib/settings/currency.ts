import type { CurrencyCodeValue } from "@/lib/settings/settings-contract";

export const currencyOptions: Array<{
  value: CurrencyCodeValue;
  label: string;
  locale: string;
}> = [
  { value: "INR", label: "Indian Rupee", locale: "en-IN" },
  { value: "USD", label: "US Dollar", locale: "en-US" },
  { value: "AED", label: "UAE Dirham", locale: "en-AE" },
  { value: "EUR", label: "Euro", locale: "en-IE" },
  { value: "GBP", label: "British Pound", locale: "en-GB" },
];

function getCurrencyLocale(currency: CurrencyCodeValue) {
  return (
    currencyOptions.find((option) => option.value === currency)?.locale ?? "en-IN"
  );
}

export function formatMoney(amount: number, currency: CurrencyCodeValue) {
  return new Intl.NumberFormat(getCurrencyLocale(currency), {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactMoney(amount: number, currency: CurrencyCodeValue) {
  if (Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat(getCurrencyLocale(currency), {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }

  return formatMoney(amount, currency);
}
