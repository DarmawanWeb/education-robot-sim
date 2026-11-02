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
  /** Throw away the selected block and everything inside it (undoable). */
  deleteSelected: () => void;
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
  /** The toolbar's bin: blocks dropped on it are deleted, like on Blockly's own trashcan. */
  binRef?: RefObject<HTMLElement | null>;
  /** Whether the selected block can be thrown away, so the bin can be pressed. */
  onSelection?: (deletable: boolean) => void;
  label: string;
}

/**
 * The bin in our toolbar, registered as a Blockly delete area: Blockly asks for its rectangle on
 * screen while a block is dragged, and deletes the block when it is dropped there.
 */
class ToolbarBin extends Blockly.DeleteArea {
  constructor(private readonly element: () => HTMLElement | null) {
    super();
    this.id = 'dctToolbarBin';
  }

  override getClientRect(): Blockly.utils.Rect | null {
    const rect = this.element()?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return new Blockly.utils.Rect(rect.top, rect.bottom, rect.left, rect.right);
  }

  override onDragEnter(): void {
    if (this.wouldDelete_) this.element()?.setAttribute('data-over', '');
  }

  override onDragExit(): void {
    this.element()?.removeAttribute('data-over');
  }

  override onDrop(): void {
    this.element()?.removeAttribute('data-over');
  }
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
  binRef,
  onSelection,
  label,
}: BlocklyWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ messages, starter, onProgramChange, onHistory, onSelection, binRef });
  useEffect(() => {
    latest.current = { messages, starter, onProgramChange, onHistory, onSelection, binRef };
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
      // Zoom, fit, undo, redo and the bin live in our own toolbar (see ToolbarBin). Blocks can
      // also be dragged back onto the categories, or deleted with the Delete key.
      trashcan: false,
      sounds: false,
      // A dot every 2 cm, like the squared mat on the edu site.
      grid: { spacing: 24, length: 2, colour: dark ? '#2b443c' : '#d5d9d2', snap: false },
      zoom: { controls: false, wheel: false, startScale: 0.85, maxScale: 1.6, minScale: 0.4 },
      move: { scrollbars: true, drag: true, wheel: true },
    });

    workspace.getComponentManager().addComponent({
      component: new ToolbarBin(() => latest.current.binRef?.current ?? null),
      weight: 1,
      capabilities: [
        Blockly.ComponentManager.Capability.DELETE_AREA,
        Blockly.ComponentManager.Capability.DRAG_TARGET,
      ],
    });
    const selection = () => {
      const selected = Blockly.getSelected();
      latest.current.onSelection?.(selected instanceof Blockly.BlockSvg && selected.isDeletable());
    };

    // Until the program is edited, keep it framed: the panel can still change size after the first
    // paint (fonts, the sticky layout), and Blockly keeps the old scroll offset when it does.
    let autoFit = true;
    const frameAll = () => {
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
      requestAnimationFrame(frameAll);
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
      if (event.type === Blockly.Events.SELECTED) selection();
      if (event.isUiEvent) return;
      autoFit = false;
      save();
      emit();
      history();
    });

    const resizeObserver = new ResizeObserver(() => {
      Blockly.svgResize(workspace);
      if (autoFit) frameAll();
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
      fit: frameAll,
      deleteSelected: () => {
        const selected = Blockly.getSelected();
        if (selected instanceof Blockly.BlockSvg && selected.isDeletable())
          selected.checkAndDelete();
      },
    };

    return () => {
      resizeObserver.disconnect();
      apiRef.current = null;
      workspace.dispose();
    };
  }, [robot, locale, dark, storageKey, apiRef]);

  return <div ref={containerRef} role="application" aria-label={label} className="h-full w-full" />;
}
