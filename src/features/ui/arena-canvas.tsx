'use client';

import { cn } from '@taksu/ui/lib/utils';
import { ScanSearch } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { moverBox } from '../engine/geometry';
import type { Simulation } from '../engine/simulation';
import type { Box } from '../engine/types';
import { buzzerPosition, drawRobot, signalLamps, silhouette } from './robot-sprite';

const ZONE_STYLE = {
  start: { fill: 'rgba(255,210,63,0.28)', stroke: '#c99700' },
  finish: { fill: 'rgba(14,107,87,0.16)', stroke: '#0e6b57' },
  checkpoint: { fill: 'rgba(76,195,255,0.18)', stroke: '#1593d0' },
} as const;

/** How much closer the follow camera gets. */
const FOLLOW_ZOOM = 2.6;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function traceLine(context: CanvasRenderingContext2D, points: readonly { x: number; y: number }[]) {
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
}

/** A hand seen from above, fingers pointing left toward the robot, with a shirt cuff. */
function drawHand(context: CanvasRenderingContext2D, box: Box) {
  const { x, y, w, h } = box;
  const finger = h / 5.2;
  context.save();
  context.fillStyle = '#3e6fb3';
  context.beginPath();
  context.roundRect(x + w * 0.9, y + h * 0.04, w * 0.9, h * 0.92, 0.6);
  context.fill();
  context.fillStyle = '#e0ac7e';
  context.strokeStyle = '#a8714a';
  context.lineWidth = 0.3;
  context.beginPath();
  context.roundRect(x + w * 0.42, y + h * 0.08, w * 0.58, h * 0.84, 1.2);
  for (const row of [0, 1, 2, 3]) {
    context.roundRect(x, y + h * 0.1 + row * (finger + 0.35), w * 0.62, finger, finger / 2);
  }
  context.roundRect(x + w * 0.38, y - h * 0.08, w * 0.36, finger * 1.05, finger / 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawArena(
  canvas: HTMLCanvasElement,
  simulation: Simulation,
  dark: boolean,
  follow: boolean,
) {
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
  const { model, pose } = simulation;

  // Camera: the whole arena, or a close view that keeps the robot in the middle.
  const zoom = follow ? FOLLOW_ZOOM : 1;
  const viewWidth = arena.width / zoom;
  const viewHeight = arena.height / zoom;
  const originX = follow ? clamp(pose.x - viewWidth / 2, 0, arena.width - viewWidth) : 0;
  const originY = follow ? clamp(pose.y - viewHeight / 2, 0, arena.height - viewHeight) : 0;
  const k = ratio * scale * zoom;
  context.setTransform(k, 0, 0, k, -originX * k, -originY * k);
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
    context.lineCap = path.closed ? 'round' : 'butt';
    context.beginPath();
    traceLine(context, path.points);
    if (path.closed) context.closePath();
    context.stroke();
  }
  context.lineCap = 'round';

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

  for (const mover of simulation.mission.arena.movers ?? []) {
    drawHand(context, moverBox(mover, simulation.time));
  }

  if (simulation.trail.length > 1) {
    context.strokeStyle = 'rgba(31,79,209,0.35)';
    context.lineWidth = 0.6;
    context.beginPath();
    traceLine(context, simulation.trail);
    context.stroke();
  }

  // Soft drop shadow. The outline itself is drawn far off the canvas and only its blurred
  // shadow is shifted back under the robot, so no solid shape shows between the parts.
  const far = canvas.width + 200;
  context.save();
  context.setTransform(k, 0, 0, k, -originX * k - far, -originY * k);
  context.shadowColor = 'rgba(20,20,20,0.32)';
  context.shadowBlur = 0.9 * k;
  context.shadowOffsetX = far + 0.5 * k;
  context.shadowOffsetY = 0.7 * k;
  context.translate(pose.x, pose.y);
  context.rotate(pose.heading);
  silhouette(context, model);
  context.fillStyle = '#000000';
  context.fill();
  context.restore();

  context.save();
  context.translate(pose.x, pose.y);
  context.rotate(pose.heading);
  drawRobot(context, {
    model,
    lineValues: simulation.lineValues,
    servoAngle: simulation.servoAngle,
    wheelTravel: simulation.wheelTravel,
    lamps: signalLamps(simulation.signal, simulation.signalShown),
  });
  context.restore();

  // Ultrasonic beam: the cone the sensor listens in, and where the echo came from.
  const cos = Math.cos(pose.heading);
  const sin = Math.sin(pose.heading);
  const sonarOrigin = {
    x: pose.x + model.sonar.forward * cos,
    y: pose.y + model.sonar.forward * sin,
  };
  const sonarAngle = pose.heading - ((simulation.servoAngle - 90) * Math.PI) / 180;
  const reach = simulation.distance;
  context.fillStyle = 'rgba(14,165,233,0.1)';
  context.beginPath();
  context.moveTo(sonarOrigin.x, sonarOrigin.y);
  context.arc(
    sonarOrigin.x,
    sonarOrigin.y,
    reach,
    sonarAngle - model.sonar.halfCone,
    sonarAngle + model.sonar.halfCone,
  );
  context.closePath();
  context.fill();
  context.strokeStyle = 'rgba(14,165,233,0.75)';
  context.lineWidth = 0.35;
  context.setLineDash([1.2, 0.8]);
  context.beginPath();
  context.moveTo(sonarOrigin.x, sonarOrigin.y);
  context.lineTo(
    sonarOrigin.x + reach * Math.cos(sonarAngle),
    sonarOrigin.y + reach * Math.sin(sonarAngle),
  );
  context.stroke();
  context.setLineDash([]);
  if (reach < model.sonar.range) {
    context.fillStyle = '#0ea5e9';
    context.beginPath();
    context.arc(
      sonarOrigin.x + reach * Math.cos(sonarAngle),
      sonarOrigin.y + reach * Math.sin(sonarAngle),
      0.8,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  // Sound rings while the buzzer is on.
  if (simulation.time < simulation.buzzingUntil) {
    const local = buzzerPosition(model);
    const at = {
      x: pose.x + local.x * cos - local.y * sin,
      y: pose.y + local.x * sin + local.y * cos,
    };
    const phase = (simulation.time * 2.5) % 1;
    context.strokeStyle = '#7c5cc4';
    for (const ring of [phase, (phase + 0.5) % 1]) {
      context.globalAlpha = 1 - ring;
      context.lineWidth = 0.45;
      context.beginPath();
      context.arc(at.x, at.y, 1.5 + ring * 5, 0, Math.PI * 2);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  // Scale bar in screen space, so the size of things on the mat is easy to read.
  const barCm = follow ? 10 : 20;
  const barPx = barCm * scale * zoom * ratio;
  const pad = 10 * ratio;
  const baseY = canvas.height - pad;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = 'rgba(255,255,255,0.8)';
  context.fillRect(pad - 4 * ratio, baseY - 18 * ratio, barPx + 8 * ratio, 22 * ratio);
  context.strokeStyle = '#141414';
  context.lineWidth = 1.5 * ratio;
  context.lineCap = 'butt';
  context.beginPath();
  context.moveTo(pad, baseY - 4 * ratio);
  context.lineTo(pad, baseY);
  context.lineTo(pad + barPx, baseY);
  context.lineTo(pad + barPx, baseY - 4 * ratio);
  context.stroke();
  context.fillStyle = '#141414';
  context.font = `700 ${11 * ratio}px 'Atkinson Hyperlegible Next Variable', system-ui, sans-serif`;
  context.textBaseline = 'alphabetic';
  context.fillText(`${barCm} cm`, pad + 2 * ratio, baseY - 6 * ratio);
}

/** Top-down arena drawn on a canvas; the simulation hook calls `drawRef` every frame. */
export function ArenaCanvas({
  simulation,
  drawRef,
  dark,
  label,
  followLabel,
}: {
  simulation: Simulation;
  drawRef: RefObject<() => void>;
  dark: boolean;
  label: string;
  followLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [follow, setFollow] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const redraw = () => drawArena(canvas, simulation, dark, follow);
    drawRef.current = redraw;
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    redraw();
    return () => {
      observer.disconnect();
      drawRef.current = () => {};
    };
  }, [simulation, drawRef, dark, follow]);

  const { width, height } = simulation.mission.arena;
  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="border-edge block w-full rounded-lg border-2"
        style={{ aspectRatio: `${width} / ${height}` }}
      />
      <button
        type="button"
        aria-pressed={follow}
        onClick={() => setFollow((value) => !value)}
        className={cn(
          'border-edge absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-md border-2 px-2.5 py-1.5 text-xs font-bold',
          follow ? 'bg-accent text-black' : 'bg-surface text-foreground hover:bg-surface-muted',
        )}
      >
        <ScanSearch className="size-3.5" aria-hidden />
        {followLabel}
      </button>
    </div>
  );
}
