<div align="center">

<img src="docs/logo.svg" width="96" alt="DCTEdu logo">

# DCTEdu Simulator

**Program DCTEdu's robots with blocks in the browser: Ciko and Momo drive a virtual track, the
missions are steps on their learning paths, and the same program comes out as Arduino C++. Free,
with no account, in Indonesian and English.**

[![CI](https://github.com/DarmawanWeb/education-robot-sim/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DarmawanWeb/education-robot-sim/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![Blockly](https://img.shields.io/badge/Blockly-13-4285F4)
![TypeScript](https://img.shields.io/badge/TypeScript-6%20strict-3178C6?logo=typescript&logoColor=white)
![Languages](https://img.shields.io/badge/UI-Indonesia%20%7C%20English-FFB020)

</div>

---

Part of [DCTEdu](https://github.com/DarmawanWeb/DCTEdu), which builds it as `apps/simulator` next
to the [store](https://github.com/DarmawanWeb/education-robot-web). Every mission is a step on a
robot's learning path in the store and links back to it. Progress stays in the browser that made
it.

## Features

- **Program**: a Blockly toolbox per robot (start, motion, control, sensors, logic and numbers,
  face, lights, and sound), saved per mission in the browser, and the same program as Arduino
  C++ for the RobotKit library, live.
- **Simulate**: two-wheel differential drive at 120 steps a second with each robot's size, speed,
  and motor mismatch; Ciko's two IR line sensors and bumper sonar; Momo's five-sensor line array,
  sonar on a servo, temperature, humidity, sound, and Wi-Fi.
- **Missions**: 20 missions, 11 for Ciko and 9 for Momo, ending in an arena challenge printed as a banner, with live goals, a hint, a starter
  program, and a reference solution the tests run, so every mission can be finished.
- **Use**: deep links (`?robot=momo&mission=momo-radar`) from the learning paths, speed 1x, 2x,
  4x, a follow camera, and dark mode for projectors in class.

## Structure

```
src/
  app/[locale]/           the one page, in /id and /en
  features/
    engine/               types, robot models, geometry, interpreter, simulation, missions
    blocks/               Blockly definitions and toolbox, workspace, compile to the program AST
    codegen/              the program AST as Arduino C++ (RobotKit)
    ui/                   app shell, mission screen, arena canvas, sensor, dashboard and code panels
  lib/                    links back to the store, locale helpers
messages/                 id.json and en.json, including every block's text
scripts/                  copies Blockly's media into public/ before dev and build
```

## Documentation

| Document | Contents |
|---|---|
| [Architecture](docs/architecture.md) | Stack, from blocks to the engine and to C++, the robots, missions and goals, the screen, Blockly and Tailwind, storage, configuration |
| [Development](docs/development.md) | Running inside the workspace, scripts, commits, CI |

## Develop

```bash
git clone --recursive https://github.com/DarmawanWeb/DCTEdu.git && cd DCTEdu
pnpm install                    # the workspace, plus the commit hooks in each submodule
pnpm dev:simulator              # http://localhost:3001/id
pnpm --filter @dctedu/simulator test
```

DCTEdu is the education robot line of PT Dharma Cipta Teknologi.

Proprietary. Copyright (c) 2026 PT Dharma Cipta Teknologi. All rights reserved.
