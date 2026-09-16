# Changelog

All notable changes to the THG community bot are documented here.

Format is SkyHanni-style: `##` release section, `###` category, `####` feature area, then `+` bullets.
See [CLAUDE.md](CLAUDE.md) for the full conventions.

## Unreleased

### New Features

#### Skyblock

+ Added `/skyblock <username>` to look up a player's selected SkyBlock profile via the Hypixel public API
  (profile name, game mode, SkyBlock level, skill average, purse, bank, and Hypixel guild when available).
  + Requires `HYPIXEL_API_KEY` in `.env`. Fields the player has hidden in-game API settings show as hidden
      rather than failing the whole lookup.
+ Added `/networth <username>` to calculate a player's richest SkyBlock profile networth via the Hypixel API
  and `skyhelper-networth` (replaces the old TriBridge SkyCrypt lookups).
  + Cached for ten minutes; one lookup per Discord user every fifteen seconds.

### Fixes

#### Core
+ Slash commands no longer run twice (removed duplicate `common.ts` event handlers that caused
  `InteractionAlreadyReplied` after `/help` and other commands)
+ `/help` no longer shows an empty Miscellaneous category (moved into Utility; categories with no
  listable commands are omitted from the picker)
+ Removed debug `console.log` spam when browsing `/help` categories

### Improvements

#### Localization

+ Dropped Dutch and Spanish string tables — the bot is English-only (`t()` with no per-user language).

### Technical Details

#### Core

+ Bumped `@discordx/utilities` to 8.0.0 so `@Category` works with `discordx` 11.13 (fixes
  `decorateUnknown is not a function` on startup)
+ Aligned Prisma on stable 7.10.0 for both `prisma` and `@prisma/client` (dropped the mismatched 8 RC CLI)
+ Added `prisma.config.ts`, switched the generator to `prisma-client`, and wired `@prisma/adapter-pg`
+ Shared a single Prisma client from `utils/prisma` (`/profile` and user helpers import it; no second pool)
+ Split Prisma client setup out of `userManager` into `utils/prisma.ts`
+ Raised the Node engine requirement to `>=20.19.0` and upgraded TypeScript to 5.9.3, Biome, chokidar 5,
  and related dependencies
+ Added `src/utils/hypixel.ts` and `src/utils/mojang.ts` for Hypixel / Mojang HTTP lookups
+ Added `skyhelper-networth` and `src/utils/networth.ts` for SkyBlock networth calculation
+ Documented `HYPIXEL_API_KEY`, `SHEETDB_API_URL` and `SHEETDB_API_KEY` in `.env.example` and
  `environment.d.ts`

#### Documentation

+ Replaced the discordx template README with a project-accurate description of the THG community bot
  (features, intents, env vars, commands, scripts, structure, database).
+ CLAUDE.md now requires the README to expand as the project expands — new commands, env vars and
  features update it in the same task.
