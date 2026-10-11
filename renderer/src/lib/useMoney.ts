import { useCallback } from 'react'
import { DEFAULT_CURRENCY, formatMoney, fromUsd, toUsd, currencySymbol } from '@shared/currency'
import { useSettings } from '@/lib/queries'

// Shows USD amounts in the currency chosen in Settings; stored values stay USD.
export function useMoney() {
  const currency = useSettings().data?.currency ?? DEFAULT_CURRENCY
  const money = useCallback((usd: number, fine = false) => formatMoney(usd, currency, fine), [currency])
  return {
    money,
    symbol: currencySymbol(currency.code),
    code: currency.code,
    // For budget inputs: the field shows the chosen currency, the store keeps USD.
    toField: (usd: number) => Math.round(fromUsd(usd, currency) * 100) / 100,
    fromField: (amount: number) => toUsd(amount, currency),
  }
}
