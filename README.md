<div align="center">

<img src="docs/logo.svg" width="96" alt="Taksu logo">

# Taksu Education Robots simulator

**The block simulator for Taksu's education robots: program Ciko and Momo with blocks, test them on
virtual tracks with real sensors and physics, and read the Arduino C++ the blocks become, before
the robot arrives. In Indonesian and English, light and dark.**

[![CI](https://github.com/DarmawanWeb/education-robot-sim/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DarmawanWeb/education-robot-sim/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/DarmawanWeb/education-robot-sim?label=release&color=e3262d)](https://github.com/DarmawanWeb/education-robot-sim/releases)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Blockly](https://img.shields.io/badge/Blockly-13-4285F4?logo=google&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6%20strict-3178C6?logo=typescript&logoColor=white)
![Arduino](https://img.shields.io/badge/output-Arduino%20C%2B%2B-00878F?logo=arduino&logoColor=white)
![Languages](https://img.shields.io/badge/UI-Indonesia%20%7C%20English-FFB020)
[![License](https://img.shields.io/badge/license-proprietary-1F2228)](LICENSE)

[Features](#features) · [Structure](#structure) · [Documentation](#documentation) · [Develop](#develop)

</div>

---

Part of [Taksu Tech](https://github.com/DarmawanWeb/TaksuTech), which deploys it as `sim`
 next to the [store](https://github.com/DarmawanWeb/education-robot-web). Every mission is
a step on a robot's learning path in the store, and links back to it. Free, in the browser, with no
account: progress stays in the browser that made it.

## Features

**Program**
- Blockly toolbox per robot: start, motion, control, sensors, logic and numbers, and the robot's
  face, lights, and sound. Programs are saved per mission in the browser.
- The same program as Arduino C++ for the RobotKit library, live, ready to paste into the
  Arduino IDE.

**Simulate**
- Two-wheel differential drive at 120 steps a second, with each robot's size, speed, and motor
  mismatch (Momo drifts until it is calibrated).
- Sensors as on the robots: Ciko's two IR line sensors and bumper sonar; Momo's five-sensor line
  array, sonar on a servo, temperature, humidity, sound, and Wi-Fi.
- Ciko's turn signals blink and tick on the buzzer; Momo sends telemetry to a dashboard panel.

**Missions**
- 18 missions, 10 for Ciko and 8 for Momo, from the first face and beep to line following,
  obstacle avoidance, radar, environment logging, and telemetry; free play for Momo.
- Goals checked live, a hint, a starter program, and a result with the reason it failed.
- Every mission has a reference solution that the tests run, so each one can be finished.

**Use**
- Deep links (`?robot=momo&mission=momo-radar`) from the learning paths; speed 1x, 2x, 4x;
  follow camera; dark mode for projectors in class.

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
| [Architecture](docs/architecture.md) | Stack, the program pipeline from blocks to the engine and to C++, the simulation, missions and goals, the screen, storage, links to the store |
| [Development](docs/development.md) | Running inside the workspace, scripts, tests, recipes for a mission, a block, and a robot, commits and CI |

## Develop

```bash
git clone --recursive https://github.com/DarmawanWeb/TaksuTech.git && cd TaksuTech
pnpm install                    # the workspace, plus the commit hooks in each submodule
pnpm dev:sim                    # http://localhost:3002/id
pnpm --filter @taksu/sim test   # every mission's reference solution, codegen, messages
```

CI ([ci.yml](.github/workflows/ci.yml)) checks out the TaksuTech workspace, puts this commit
at `apps/sim`, and runs Biome, the typecheck, the tests, and the build. The images are built by the
[TaksuTech](https://github.com/DarmawanWeb/TaksuTech) repository.

Proprietary. Copyright (c) 2026 Taksu Tech, part of Ezra Robotics. All rights reserved.
