export interface ProjectModes {
  engineering: boolean
  factory: boolean
}

// The skill pack in <userData>/engineering: the files the owner edited (relative to that folder) and the folder.
export interface EngineeringStatus {
  edited: string[]
  folder: string
}

export interface PackDirs {
  // <userData>/engineering/engineering and <userData>/engineering/factory.
  engineeringDir: string
  factoryDir: string
}

// The block added to a Claude tile's appended system prompt for the project's modes; '' when both are off.
export function buildPreamble(modes: ProjectModes, dirs: PackDirs): string {
  const at = (dir: string, rest: string) => `${dir.replace(/[\\/]+$/, '')}/${rest}`
  const blocks: string[] = []
  if (modes.engineering) {
    blocks.push(
      `Engineering Mode is on for this project. For every new task read ${at(dirs.engineeringDir, 'skills/flow/SKILL.md')} and follow it. Read each stage skill file before using that stage. One approval gate: the plan. Never push. Max 3 verify passes then ask. Task files live in .operant/engineering/<task-name>/.`,
    )
  }
  if (modes.factory) {
    blocks.push(
      `Subagent Factory Mode is on. Read ${at(dirs.factoryDir, 'skills/factory/SKILL.md')}. The lead plans and reviews and does bulk work through helper agents using Task Cards (${at(dirs.factoryDir, 'skills/factory/task-card.md')}); paste ${at(dirs.factoryDir, 'skills/factory/worker-brief.md')} into every helper brief; max 3 helpers at once, max 3 per job, one build at a time.`,
    )
  }
  return blocks.join('\n\n')
}
