import { describe, expect, it } from 'vitest'
import { DEFAULT_CURRENCY, formatMoney, fromUsd, sanitizeCurrency, toUsd } from './currency'
import { DEFAULT_SETTINGS, mergeSettings, sanitizeSettings } from './settings'

describe('formatMoney', () => {
  it('leaves USD as it was', () => {
    expect(formatMoney(12.5)).toBe('$12.50')
    expect(formatMoney(0)).toBe('$0.00')
    expect(formatMoney(3, DEFAULT_CURRENCY)).toBe('$3.00')
  })

  it('multiplies by the rate and uses the symbol', () => {
    expect(formatMoney(10, { code: 'GBP', rate: 0.8 })).toBe('£8.00')
    expect(formatMoney(2, { code: 'JPY', rate: 150 })).toBe('¥300.00')
    expect(formatMoney(1, { code: 'CAD', rate: 1.35 })).toBe('C$1.35')
  })

  it('keeps the tiny-value form with the symbol', () => {
    expect(formatMoney(0.004)).toBe('<$0.01')
    expect(formatMoney(0.004, { code: 'EUR', rate: 0.9 })).toBe('<€0.01')
  })

  it('shows four decimals for small amounts when fine', () => {
    expect(formatMoney(0.0042, DEFAULT_CURRENCY, true)).toBe('$0.0042')
  })
})

describe('converting typed amounts', () => {
  it('round trips through USD', () => {
    const c = { code: 'GBP' as const, rate: 0.8 }
    expect(toUsd(8, c)).toBeCloseTo(10)
    expect(fromUsd(10, c)).toBeCloseTo(8)
  })
})

describe('sanitizeCurrency', () => {
  it('falls back to USD at 1 for bad values', () => {
    expect(sanitizeCurrency(undefined)).toEqual({ code: 'USD', rate: 1 })
    expect(sanitizeCurrency({ code: 'XXX', rate: 5 })).toEqual({ code: 'USD', rate: 1 })
    expect(sanitizeCurrency({ code: 'GBP', rate: -2 })).toEqual({ code: 'GBP', rate: 1 })
    expect(sanitizeCurrency({ code: 'GBP', rate: 'x' })).toEqual({ code: 'GBP', rate: 1 })
    expect(sanitizeCurrency({ code: 'EUR', rate: Infinity })).toEqual({ code: 'EUR', rate: 1 })
  })

  it('keeps a good value and forces USD to rate 1', () => {
    expect(sanitizeCurrency({ code: 'GBP', rate: 0.79 })).toEqual({ code: 'GBP', rate: 0.79 })
    expect(sanitizeCurrency({ code: 'USD', rate: 3 })).toEqual({ code: 'USD', rate: 1 })
  })

  it('is part of the settings', () => {
    expect(DEFAULT_SETTINGS.currency).toEqual({ code: 'USD', rate: 1 })
    expect(sanitizeSettings({ currency: { code: 'INR', rate: 83 } }).currency).toEqual({ code: 'INR', rate: 83 })
    expect(mergeSettings(DEFAULT_SETTINGS, { currency: { code: 'GBP' } }).currency.code).toBe('GBP')
  })
})
