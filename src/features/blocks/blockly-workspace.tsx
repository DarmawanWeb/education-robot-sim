'use client';

import type { Locale } from '@dctedu/catalog';
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
  undo: () => void;
  redo: () => void;
  zoom: (steps: number) => void;
  /** Bring every block into view, at no more than a comfortable size. */
  fit: () => void;
}

/** Whether there is anything to undo or redo, for the workspace toolbar. */
export interface History {
  undo: boolean;
  redo: boolean;
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
  onHistory?: (history: History) => void;
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
  onHistory,
  label,
}: BlocklyWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ messages, starter, onProgramChange, onHistory });
  useEffect(() => {
    latest.current = { messages, starter, onProgramChange, onHistory };
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    Blockly.setLocale((locale === 'id' ? Id : En) as unknown as Record<string, string>);
    Object.assign(Blockly.Msg, latest.current.messages);
    registerBlocks();

    // Thin scrollbars; Blockly's default is thick enough for a finger on every screen.
    Blockly.Scrollbar.scrollbarThickness = 10;
    const workspace = Blockly.inject(container, {
      toolbox: buildToolbox(robot),
      theme: dark ? darkTheme : lightTheme,
      renderer: 'zelos',
      media: '/blockly-media/',
      // Zoom, fit, undo and redo live in our own toolbar; blocks are deleted by dragging them
      // back onto the categories, or with the Delete key.
      trashcan: false,
      sounds: false,
      // A dot every 2 cm, like the squared mat on the edu site.
      grid: { spacing: 24, length: 2, colour: dark ? '#2b443c' : '#d5d9d2', snap: false },
      zoom: { controls: false, wheel: false, startScale: 0.85, maxScale: 1.6, minScale: 0.4 },
      move: { scrollbars: true, drag: true, wheel: true },
    });

    // Until the program is edited, keep it framed: the panel can still change size after the first
    // paint (fonts, the sticky layout), and Blockly keeps the old scroll offset when it does.
    let autoFit = true;
    const fit = () => {
      workspace.zoomToFit();
      // A short program would fill the screen at maximum zoom: keep it at a readable size and put
      // its first stack in the middle. (scrollCenter() also counts the hidden flyout's width.)
      if (workspace.scale > 0.95) {
        workspace.setScale(0.95);
        const first = workspace.getTopBlocks(true)[0];
        if (first) workspace.centerOnBlock(first.id);
      }
    };
    const history = () =>
      latest.current.onHistory?.({
        undo: workspace.getUndoStack().length > 0,
        redo: workspace.getRedoStack().length > 0,
      });

    /** Show a program. On first load it starts a fresh history; from the toolbar it can be undone. */
    const load = (state: object, undoable = false) => {
      if (undoable) Blockly.Events.setGroup(true);
      else Blockly.Events.disable();
      try {
        workspace.clear();
        Blockly.serialization.workspaces.load(state, workspace);
      } catch {
        workspace.clear();
        Blockly.serialization.workspaces.load(latest.current.starter, workspace);
      } finally {
        if (undoable) Blockly.Events.setGroup(false);
        else Blockly.Events.enable();
      }
      save();
      emit();
      if (!undoable) workspace.clearUndo();
      history();
      autoFit = true;
      requestAnimationFrame(fit);
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
      autoFit = false;
      save();
      emit();
      history();
    });

    const resizeObserver = new ResizeObserver(() => {
      Blockly.svgResize(workspace);
      if (autoFit) fit();
    });
    resizeObserver.observe(container);

    apiRef.current = {
      compile: () => compileWorkspace(workspace),
      highlight: (blockId) => workspace.highlightBlock(blockId),
      load: (state) => load(state, true),
      undo: () => workspace.undo(false),
      redo: () => workspace.undo(true),
      zoom: (steps) => {
        autoFit = false;
        workspace.zoomCenter(steps);
      },
      fit,
    };

    return () => {
      resizeObserver.disconnect();
      apiRef.current = null;
      workspace.dispose();
    };
  }, [robot, locale, dark, storageKey, apiRef]);

  return <div ref={containerRef} role="application" aria-label={label} className="h-full w-full" />;
}
