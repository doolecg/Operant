import { describe, expect, it } from 'vitest'
import { FACTORY_ROLES } from '../shared/engineering'
import { BUILTIN_PRESETS } from './store'

describe('Factory roles', () => {
  it('each starts from exactly one built-in Claude preset', () => {
    for (const r of FACTORY_ROLES) {
      const found = BUILTIN_PRESETS.filter((p) => p.builtin === r.preset)
      expect(found.map((p) => p.agent), r.key).toEqual(['claude'])
    }
  })
})
