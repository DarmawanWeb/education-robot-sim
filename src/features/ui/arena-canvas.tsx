'use client';

import { type RefObject, useEffect, useRef } from 'react';
import type { Simulation } from '../engine/simulation';

const ZONE_STYLE = {
  start: { fill: 'rgba(31,79,209,0.10)', stroke: '#1f4fd1' },
  finish: { fill: 'rgba(29,116,102,0.16)', stroke: '#1d7466' },
  checkpoint: { fill: 'rgba(245,158,11,0.12)', stroke: '#d97706' },
} as const;

function traceLine(context: CanvasRenderingContext2D, points: readonly { x: number; y: number }[]) {
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
}

function drawArena(canvas: HTMLCanvasElement, simulation: Simulation, dark: boolean) {
  const { arena } = simulation.mission;
  const context = canvas.getContext('2d');
  if (!context) return;
  const cssWidth = canvas.clientWidth || 640;
  const ratio = window.devicePixelRatio || 1;
  const scale = cssWidth / arena.width;
  const pixelWidth = Math.round(cssWidth * ratio);
  const pixelHeight = Math.round(arena.height * scale * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  // Draw in centimetres.
  context.setTransform(ratio * scale, 0, 0, ratio * scale, 0, 0);
  context.lineJoin = 'round';
  context.lineCap = 'round';

  context.fillStyle = dark ? '#e7e4da' : '#fbfaf6';
  context.fillRect(0, 0, arena.width, arena.height);
  context.strokeStyle = 'rgba(31,79,209,0.09)';
  context.lineWidth = 0.15;
  for (let x = 10; x < arena.width; x += 10) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, arena.height);
    context.stroke();
  }
  for (let y = 10; y < arena.height; y += 10) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(arena.width, y);
    context.stroke();
  }

  for (const zone of arena.zones) {
    const style = ZONE_STYLE[zone.kind];
    const visited =
      simulation.met.has(zone.id) ||
      (zone.kind === 'checkpoint' && simulation.visited.has(zone.id));
    context.fillStyle = visited ? 'rgba(29,116,102,0.28)' : style.fill;
    context.fillRect(zone.x, zone.y, zone.w, zone.h);
    context.setLineDash(zone.kind === 'checkpoint' ? [1.5, 1.2] : []);
    context.strokeStyle = style.stroke;
    context.lineWidth = 0.4;
    context.strokeRect(zone.x, zone.y, zone.w, zone.h);
  }
  context.setLineDash([]);

  context.strokeStyle = '#141414';
  for (const path of arena.lines) {
    context.lineWidth = path.width;
    context.beginPath();
    traceLine(context, path.points);
    if (path.closed) context.closePath();
    context.stroke();
  }

  for (const box of arena.boxes) {
    context.fillStyle = '#c98c4c';
    context.strokeStyle = '#7a4f22';
    context.lineWidth = 0.6;
    context.fillRect(box.x, box.y, box.w, box.h);
    context.strokeRect(box.x, box.y, box.w, box.h);
    context.beginPath();
    context.moveTo(box.x, box.y);
    context.lineTo(box.x + box.w, box.y + box.h);
    context.moveTo(box.x + box.w, box.y);
    context.lineTo(box.x, box.y + box.h);
    context.strokeStyle = 'rgba(122,79,34,0.45)';
    context.stroke();
  }

  if (simulation.trail.length > 1) {
    context.strokeStyle = 'rgba(31,79,209,0.35)';
    context.lineWidth = 0.6;
    context.beginPath();
    traceLine(context, simulation.trail);
    context.stroke();
  }

  const { model, pose } = simulation;
  const cos = Math.cos(pose.heading);
  const sin = Math.sin(pose.heading);
  const sonarOrigin = {
    x: pose.x + model.sonar.forward * cos,
    y: pose.y + model.sonar.forward * sin,
  };
  const sonarAngle = pose.heading - ((simulation.servoAngle - 90) * Math.PI) / 180;
  context.strokeStyle = 'rgba(14,165,233,0.75)';
  context.lineWidth = 0.4;
  context.setLineDash([1.2, 0.8]);
  context.beginPath();
  context.moveTo(sonarOrigin.x, sonarOrigin.y);
  context.lineTo(
    sonarOrigin.x + simulation.distance * Math.cos(sonarAngle),
    sonarOrigin.y + simulation.distance * Math.sin(sonarAngle),
  );
  context.stroke();
  context.setLineDash([]);

  context.save();
  context.translate(pose.x, pose.y);
  context.rotate(pose.heading);
  const halfLength = model.length / 2;
  const halfWidth = model.width / 2;
  context.fillStyle = '#1e1e1e';
  context.fillRect(-3.5, -halfWidth - 1.2, 7, 2.4);
  context.fillRect(-3.5, halfWidth - 1.2, 7, 2.4);
  context.fillStyle = model.id === 'sd' ? '#2f6fe0' : '#d24a43';
  context.strokeStyle = model.id === 'sd' ? '#173f8f' : '#7d1f1a';
  context.lineWidth = 0.5;
  context.beginPath();
  context.roundRect(-halfLength, -halfWidth + 0.6, model.length, model.width - 1.2, 2.5);
  context.fill();
  context.stroke();
  if (model.id === 'smp') {
    context.fillStyle = '#1f7a4d';
    context.fillRect(-halfLength + 3, -halfWidth + 2.5, model.length - 7, model.width - 5);
  } else {
    context.fillStyle = '#0b1530';
    context.fillRect(-2, -3.2, 5, 6.4);
  }
  context.fillStyle = '#c7ccd6';
  context.beginPath();
  context.arc(halfLength - 1.2, -2.2, 1.3, 0, Math.PI * 2);
  context.arc(halfLength - 1.2, 2.2, 1.3, 0, Math.PI * 2);
  context.fill();
  model.lineSensors.forEach((sensor, index) => {
    context.fillStyle = (simulation.lineValues[index] ?? 0) > 500 ? '#ef4444' : '#475569';
    context.beginPath();
    context.arc(sensor.x, sensor.y, 0.75, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

/** Top-down arena drawn on a canvas; the simulation hook calls `drawRef` every frame. */
export function ArenaCanvas({
  simulation,
  drawRef,
  dark,
  label,
}: {
  simulation: Simulation;
  drawRef: RefObject<() => void>;
  dark: boolean;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const redraw = () => drawArena(canvas, simulation, dark);
    drawRef.current = redraw;
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    redraw();
    return () => {
      observer.disconnect();
      drawRef.current = () => {};
    };
  }, [simulation, drawRef, dark]);

  const { width, height } = simulation.mission.arena;
  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className="border-border block w-full rounded-lg border"
      style={{ aspectRatio: `${width} / ${height}` }}
    />
  );
}
