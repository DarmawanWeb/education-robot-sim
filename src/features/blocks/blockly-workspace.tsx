'use client';

import type { Locale } from '@taksu/content';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as En from 'blockly/msg/en';
import * as Id from 'blockly/msg/id';
import { type RefObject, useEffect, useRef } from 'react';
import type { RobotId } from '../engine/types';
import { type CompileResult, compileWorkspace } from './compile';
import { buildToolbox, darkTheme, lightTheme, registerBlocks } from './definitions';

export interface WorkspaceApi {
  compile: () => CompileResult;
  highlight: (blockId: string | null) => void;
  load: (state: object) => void;
}

export interface BlocklyWorkspaceProps {
  robot: RobotId;
  locale: Locale;
  dark: boolean;
  /** SIM_* labels for the custom blocks in the active locale. */
  messages: Record<string, string>;
  storageKey: string;
  starter: object;
  apiRef: RefObject<WorkspaceApi | null>;
  onProgramChange: (result: CompileResult) => void;
  label: string;
}

function readSaved(key: string): object | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as object) : null;
  } catch {
    return null;
  }
}

/** Client-only Blockly workspace (loaded with ssr: false). Re-created on locale, theme, or mission change. */
export default function BlocklyWorkspace({
  robot,
  locale,
  dark,
  messages,
  storageKey,
  starter,
  apiRef,
  onProgramChange,
  label,
}: BlocklyWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ messages, starter, onProgramChange });
  useEffect(() => {
    latest.current = { messages, starter, onProgramChange };
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    Blockly.setLocale((locale === 'id' ? Id : En) as unknown as Record<string, string>);
    Object.assign(Blockly.Msg, latest.current.messages);
    registerBlocks();

    const workspace = Blockly.inject(container, {
      toolbox: buildToolbox(robot),
      theme: dark ? darkTheme : lightTheme,
      renderer: 'zelos',
      media: '/blockly-media/',
      trashcan: true,
      sounds: false,
      zoom: { controls: true, wheel: false, startScale: 0.8, maxScale: 1.6, minScale: 0.4 },
      move: { scrollbars: true, drag: true, wheel: true },
    });

    const load = (state: object) => {
      Blockly.Events.disable();
      try {
        workspace.clear();
        Blockly.serialization.workspaces.load(state, workspace);
      } catch {
        workspace.clear();
        Blockly.serialization.workspaces.load(latest.current.starter, workspace);
      } finally {
        Blockly.Events.enable();
      }
      save();
      emit();
    };
    const save = () => {
      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify(Blockly.serialization.workspaces.save(workspace)),
        );
      } catch {
        // Storage can be unavailable (private mode); the workspace still works.
      }
    };
    const emit = () => latest.current.onProgramChange(compileWorkspace(workspace));

    load(readSaved(storageKey) ?? latest.current.starter);
    workspace.addChangeListener((event: Blockly.Events.Abstract) => {
      if (event.isUiEvent) return;
      save();
      emit();
    });

    const resizeObserver = new ResizeObserver(() => Blockly.svgResize(workspace));
    resizeObserver.observe(container);

    apiRef.current = {
      compile: () => compileWorkspace(workspace),
      highlight: (blockId) => workspace.highlightBlock(blockId),
      load,
    };

    return () => {
      resizeObserver.disconnect();
      apiRef.current = null;
      workspace.dispose();
    };
  }, [robot, locale, dark, storageKey, apiRef]);

  return <div ref={containerRef} role="application" aria-label={label} className="h-full w-full" />;
}
