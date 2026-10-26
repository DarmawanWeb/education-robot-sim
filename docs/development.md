# Development

## Setup

The simulator builds inside the [TaksuTech](https://github.com/DarmawanWeb/TaksuTech)
workspace, which holds the lockfile and the shared packages (`@dctedu/catalog`, `@dctedu/ui`,
`@dctedu/typescript-config`).

```bash
git clone --recursive https://github.com/DarmawanWeb/TaksuTech.git && cd TaksuTech
corepack enable                 # pnpm 10, Node 22.12 or newer
pnpm install                    # also points this submodule's git hooks at the workspace's
pnpm dev:sim                    # http://localhost:3002/id
pnpm dev:edu                    # http://localhost:3003/id, for the learning-path links
```

## Scripts

Run from the workspace root (`pnpm --filter @dctedu/simulator <script>`) or from `apps/sim`.

| Script | Does |
|---|---|
| `dev` | Copies Blockly's media, then the Next.js dev server on port 3002 |
| `build`, `start` | Production build (standalone) and server |
| `typecheck` | `next typegen`, then `tsc --noEmit` |
| `test` | Vitest: every mission's reference solution, the interpreter, C++ output, messages |
| `lint` | Biome lint |

## Commits

This is its own repository: commit inside `apps/sim` and push it, then record the new commit in
the workspace (`git add apps/sim`, `chore: update sim`). The workspace's hooks run here too:
lint-staged formats the staged files with Biome, and commitlint checks the message (Conventional
Commits, lower-case subject).

## Recipes

**A mission.**
1. Add it to `src/features/engine/missions.ts`: the arena (centimetres, x right, y down), the
   start pose, the time limit, goals, a hint in both languages, a starter program, and a
   reference `solution`. The tests run every solution, so a mission that cannot be finished
   fails CI.
2. Add its title and brief to `packages/catalog/src/sim-missions.ts` in the workspace, in the
   order a student meets it.
3. Point a learning-path step at it (`mission:` in `packages/catalog/src/learn.ts`). The
   simulator then shows "step n of N" and links back to that step in the store.

**A block.**
1. Define it in `src/features/blocks/definitions.ts` and add it to the toolbox of the robots that
   have the part.
2. Compile it to a statement or expression in `compile.ts`; add the case to `engine/types.ts`,
   the interpreter, and the simulation if it does something new.
3. Print it in `codegen/cpp.ts` as a call the RobotKit library provides, with a test in
   `cpp.test.ts`.
4. Add its text to `messages/id.json` and `messages/en.json` under `Blocks`.

**A robot.** Add its model to `engine/robots.ts` (sizes, speed, motor bias, sensor positions),
its sprite to `ui/robot-sprite.ts`, its colour to `@dctedu/ui`, and its catalogue entry with
`sim:` in `packages/catalog/src/robots.ts`.

## The C++ contract

The C++ panel assumes the RobotKit Arduino library: `RobotKit robot(RobotKit::CIKO)` (or `MOMO`),
`robot.forward(speed, ms)`, `robot.turnLeft(...)`, `robot.signal(Signal::Left, tick)`,
`robot.lineLeft()`, `robot.distance()`, and so on. A new block that prints a call the library does
not have yet needs that call added to the library first.

## CI

[ci.yml](../.github/workflows/ci.yml) checks out the TaksuTech workspace with its
submodules, replaces `apps/sim` with the commit under test, installs, and runs Biome, the
typecheck, the tests, and the build for `@dctedu/simulator`. On pull requests it also runs commitlint.
Images are published by the workspace repository.
