<p align="center"><img src="docs/logo.png" width="160" alt="Operant 3"></p>

# Operant 3

A home for your coding terminals. Claude Code and OpenCode side by side, with memory and skills kept per project.

## Features

- **Terminals as tiles.** Claude Code and OpenCode per project, in a Chat or Terminal view, with model and context on each tile.
- **Mods.** An Agents panel for sub-agents, a Commands menu, and an activity box for learning and memory.
- **Memory that sticks.** Lessons from finished sessions go to the project's Hindsight bank. Useful procedures become skills you approve once, for every session.
- **Usage at a glance.** Plan rings for the 5-hour and weekly limits, budgets and export.
- **Git, backups, presets and themes**, with settings applied live.

## Install

Download the installer for your system from [Releases](https://github.com/doolecg/Operant/releases): `.msi` for Windows, `.dmg` for macOS (Apple silicon or Intel), `.AppImage` or `.deb` for Linux. Operant then updates itself.

You need [Claude Code](https://code.claude.com) (`claude`) or OpenCode (`opencode`) on your `PATH`.

### What Operant runs on your machine

Read this before the first start. By using Operant you agree to it running the following.

- **PowerShell with `-ExecutionPolicy Bypass` (Windows only).** Operant starts PowerShell for its own bundled scripts with `-ExecutionPolicy Bypass`: the media controls helper (`media-helper.ps1`, running in the background while Operant is open) and the updater (which asks for admin rights through a Windows UAC prompt before it installs a new version). The bypass applies only to that one PowerShell process. Operant does not change your machine's execution policy and does not run scripts other than its own this way.
- **Installs of optional tools, only when you ask.** On the first start a setup window offers optional tools (OpenCode, uv, CodeGraph, Playwright's Chromium and more). Nothing is ticked and nothing runs until you choose. Each install runs a normal package manager command such as `npm i -g @opencode/cli`, `winget install --id astral-sh.uv -e` or `npx playwright install chromium`, and Settings, Install shows the exact command before it runs. These install system-wide or for your user account, outside Operant's folder.
- **Cookie import, only when you ask.** Settings, Browser can read your default browser's cookies through PowerShell after you confirm.

If you do not want any of this, do not install Operant, or skip the setup window and leave Settings, Install alone. Without the optional tools the features that need them stay hidden and the console shows `ENOENT` lines for the missing commands; that is expected.

### Privacy: what leaves your computer

Operant has no analytics, tracking or crash reporting, and no account of its own. Your projects, chats, lessons and settings stay in Operant's data folder on your computer. These are the only connections Operant makes, and why:

- **Updates.** At start and every few hours Operant asks GitHub (`api.github.com`) for the latest release and downloads the installer from there. GitHub sees your IP address and that you run Operant.
- **Claude Code, OpenCode and other AI tools.** They send your prompts and the files they read to their own services, under your account and their terms. Operant does not see or control that traffic.
- **Claude plan limits (off by default).** If you turn this on in Settings, Tokens and budgets, Operant sends the login token that Claude Code keeps on your computer to Anthropic (`api.anthropic.com`) every few minutes to read your 5-hour and weekly limits. Anthropic's terms may not allow other apps to use that login. Leave it off if you are not sure.
- **z.ai plan limits.** Only if you have set a z.ai key for Claude Code, Operant asks z.ai for your plan usage with that key.
- **Memory (Hindsight).** By default it runs on your computer. If you point it at a LAN or remote server in Settings, the lessons Operant saves go to that server.
- **Dictation.** Installing dictation downloads a speech model from Hugging Face (`huggingface.co`). Speech is turned into text on your computer.
- **Browser tile.** It loads the sites you open. Its default search is DuckDuckGo. If you turn on AI control, an AI agent can drive that browser; Operant opens a debugging port on `127.0.0.1` (your own computer only) for this.
- **Tools you install.** Optional installs (OpenCode, uv, CodeGraph, Playwright's Chromium and more) download from npm, winget, PyPI and the tools' own sites when you choose to install them.

## Development

Needs Node.js 24.

```bash
npm install
npm run dev        # app with the Vite dev server
npm test           # unit tests
npm run dist       # installers for this system into dist/
```

Optional settings go in a `.env` (copy `.env.example`).

## License

Operant is released under the [MIT License](LICENSE). Copyright © 2026 doolecg.

Operant is provided "as is", without warranty of any kind. To the extent permitted by law, the authors are not liable for any claim, damages or other liability arising from its use. That includes what an AI agent does in a terminal you start in Operant: agents can read, change and delete files and run commands with your permissions, so review what you let them do.

Claude Code, OpenCode, Hindsight, CodeGraph, Playwright and the other tools Operant starts or installs are separate software under their own licenses and terms, which you accept with their makers when you install or use them. Claude Code is a product of Anthropic and is not open source. Operant is not made by, endorsed by or affiliated with Anthropic or the makers of those tools; their names are used only to say what Operant works with.

The Engineering Mode and Subagent Factory Mode skill packs (`plugin/engineering` and `plugin/factory`) are written fresh for Operant. Their ideas draw on [mattpocock/skills](https://github.com/mattpocock/skills) (MIT, Matt Pocock) and [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT, Addy Osmani). Their copyright notices are in `THIRD_PARTY_NOTICES.txt`.

Each installer ships `LICENSE.txt` and `THIRD_PARTY_NOTICES.txt` (the licenses of every package bundled with the app) in the `licenses` folder of the app's resources, alongside Electron's and Chromium's licenses. Settings, General, License opens that folder.

## Disclaimer

This software is provided "as is", without warranty of any kind, as set out in the [LICENSE](LICENSE). To the extent permitted by law, the authors are not liable for any loss or damage from using it, including lost data, lost work or damage to files or projects. Nothing here limits liability that cannot be limited by law, such as for death or personal injury caused by negligence.

Back up your work before using it. You use it at your own risk.

Claude Code, OpenCode and the other AI tools Operant starts send your prompts and the files they read to their own services under your account and their terms. Operant does not control that. Not affiliated with or endorsed by Anthropic. AI output can be wrong; check it before relying on it.

Operant's browser tile and the cookie import can reach any website you point them at. You are responsible for following the terms of service of any site you use them with, and for copyright in anything you download. Use them only for content you have the right to access.

## Credits

Inspired by [OpenRig](https://github.com/mvschwarz/openrig) and [Paperclip](https://github.com/paperclipai/paperclip). Built with [CodeGraph](https://github.com/colbymchenry/codegraph) and [shadcn/ui](https://github.com/shadcn-ui/ui).
