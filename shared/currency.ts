// Money is stored and computed in US dollars; this only changes how it is shown and typed.
export const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US dollar' },
  { code: 'GBP', symbol: '£', label: 'British pound' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian dollar' },
  { code: 'JPY', symbol: '¥', label: 'Japanese yen' },
  { code: 'CHF', symbol: 'CHF', label: 'Swiss franc' },
  { code: 'SEK', symbol: 'kr', label: 'Swedish krona' },
  { code: 'NZD', symbol: 'NZ$', label: 'New Zealand dollar' },
  { code: 'INR', symbol: '₹', label: 'Indian rupee' },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']

// rate = how many units of the currency one US dollar buys, typed by the user.
export interface CurrencySetting {
  code: CurrencyCode
  rate: number
}

export const DEFAULT_CURRENCY: CurrencySetting = { code: 'USD', rate: 1 }

export const CURRENCY_RATE_MAX = 1_000_000

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? '$'
}

export function sanitizeCurrency(raw: unknown): CurrencySetting {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const code = CURRENCIES.find((c) => c.code === r.code)?.code ?? DEFAULT_CURRENCY.code
  const ok = typeof r.rate === 'number' && Number.isFinite(r.rate) && r.rate > 0 && r.rate <= CURRENCY_RATE_MAX
  return { code, rate: code === 'USD' ? 1 : ok ? (r.rate as number) : DEFAULT_CURRENCY.rate }
}

// A USD amount as text in the chosen currency: two decimals, '<$0.01' style for tiny positive values.
// fine: four decimals under 1, for the small per-call amounts of learn and memory calls.
export function formatMoney(usd: number, currency: CurrencySetting = DEFAULT_CURRENCY, fine = false): string {
  const sym = currencySymbol(currency.code)
  const v = usd * currency.rate
  const digits = fine && Math.abs(v) < 1 ? 4 : 2
  if (v > 0 && v < 0.01 && !fine) return `<${sym}0.01`
  const text = Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return `${v < 0 ? '-' : ''}${sym}${text}`
}

// Amount typed in the chosen currency to USD, and back.
export const toUsd = (amount: number, currency: CurrencySetting) => amount / currency.rate
export const fromUsd = (usd: number, currency: CurrencySetting) => usd * currency.rate
