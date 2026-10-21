<p align="center"><img src="docs/logo.png" width="160" alt="Operant 3"></p>

# Operant 3

A home for your coding terminals. Claude Code and OpenCode side by side, with memory and skills kept per project.

## Features

- **Terminals as tiles.** Claude Code and OpenCode per project, in a Chat or Terminal view, with model and context on each tile.
- **Claude Mods.** An Agents panel for sub-agents, a Commands menu, and an activity box for learning and memory.
- **Memory that sticks.** Lessons from finished sessions go to the project's Hindsight bank. Useful procedures become skills you approve once, for every session.
- **Usage at a glance.** Plan rings for the 5-hour and weekly limits, budgets and export.
- **Git, backups, presets and themes**, with settings applied live.

## Install

Download the installer for your system from [Releases](https://github.com/doolecg/operant2/releases): `.msi` for Windows, `.dmg` for macOS (Apple silicon or Intel), `.AppImage` or `.deb` for Linux. Operant then updates itself.

You need [Claude Code](https://code.claude.com) (`claude`) or OpenCode (`opencode`) on your `PATH`.

### What Operant runs on your machine

Read this before the first start. By using Operant you agree to it running the following.

- **PowerShell with `-ExecutionPolicy Bypass` (Windows only).** Operant starts PowerShell for its own bundled scripts with `-ExecutionPolicy Bypass`: the media controls helper (`media-helper.ps1`, running in the background while Operant is open) and the updater (which asks for admin rights through a Windows UAC prompt before it installs a new version). The bypass applies only to that one PowerShell process. Operant does not change your machine's execution policy and does not run scripts other than its own this way.
- **Installs of optional tools, only when you ask.** On the first start a setup window offers optional tools (OpenCode, uv, CodeGraph, Playwright's Chromium and more). Nothing is ticked and nothing runs until you choose. Each install runs a normal package manager command such as `npm i -g @opencode/cli`, `winget install --id astral-sh.uv -e` or `npx playwright install chromium`, and Settings, Install shows the exact command before it runs. These install system-wide or for your user account, outside Operant's folder.
- **Cookie import, only when you ask.** Settings, Browser can read your default browser's cookies through PowerShell after you confirm.

If you do not want any of this, do not install Operant, or skip the setup window and leave Settings, Install alone. Without the optional tools the features that need them stay hidden and the console shows `ENOENT` lines for the missing commands; that is expected.

## Development

Needs Node.js 24.

```bash
npm install
npm run dev        # app with the Vite dev server
npm test           # unit tests
npm run dist       # installers for this system into dist/
```

Optional settings go in a `.env` (copy `.env.example`).

## Credits

Inspired by [OpenRig](https://github.com/mvschwarz/openrig) and [Paperclip](https://github.com/paperclipai/paperclip). Built with [CodeGraph](https://github.com/colbymchenry/codegraph) and [shadcn/ui](https://github.com/shadcn-ui/ui).
