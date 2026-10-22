import type { DatabaseSync } from 'node:sqlite'
import type { ProjectAction } from '../shared/types'

type Row = Record<string, unknown>

const NAME_MAX = 60
const COMMAND_MAX = 2000
const toAction = (r: Row): ProjectAction => ({ id: Number(r.id), crewId: Number(r.crew_id), name: String(r.name), command: String(r.command), keybinding: String(r.keybinding) })

// The saved commands of each project. Refusals throw plain errors; core maps them to codes.
export class ProjectActions {
  constructor(private readonly db: DatabaseSync) {}

  list(crewId: number): ProjectAction[] {
    return (this.db.prepare('SELECT * FROM project_actions WHERE crew_id = ? ORDER BY id').all(crewId) as Row[]).map(toAction)
  }

  get(id: number): ProjectAction {
    const row = this.db.prepare('SELECT * FROM project_actions WHERE id = ?').get(id) as Row | undefined
    if (!row) throw new Error(`Action ${String(id)} not found`)
    return toAction(row)
  }

  save(input: Omit<ProjectAction, 'id'> & { id?: number }): ProjectAction {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    const command = typeof input.command === 'string' ? input.command.trim() : ''
    if (!name) throw new Error('The action name cannot be empty')
    if (name.length > NAME_MAX) throw new Error(`The action name is longer than ${String(NAME_MAX)} characters`)
    if (!command) throw new Error('The command cannot be empty')
    if (command.length > COMMAND_MAX) throw new Error(`The command is longer than ${String(COMMAND_MAX)} characters`)
    const keybinding = typeof input.keybinding === 'string' ? input.keybinding : ''
    if (input.id === undefined) {
      const r = this.db.prepare('INSERT INTO project_actions (crew_id, name, command, keybinding) VALUES (?, ?, ?, ?)').run(input.crewId, name, command, keybinding)
      return this.get(Number(r.lastInsertRowid))
    }
    this.get(input.id)
    this.db.prepare('UPDATE project_actions SET name = ?, command = ?, keybinding = ? WHERE id = ?').run(name, command, keybinding, input.id)
    return this.get(input.id)
  }

  delete(id: number): void {
    this.get(id)
    this.db.prepare('DELETE FROM project_actions WHERE id = ?').run(id)
  }
}
