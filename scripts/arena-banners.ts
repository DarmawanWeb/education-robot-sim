/**
 * Draws the arena banners we sell as print-ready PDFs at full size, one per robot, from the same
 * geometry as the simulator's "Follow the line" missions: a program that finishes the mission on
 * screen can be run on the banner as it is.
 *
 *   pnpm --filter @dctedu/simulator arena:pdf      writes print/arena-<robot>.pdf
 *
 * Everything is vector and measured in centimetres, so the print shop prints at 100 % with no
 * scaling. The page is the banner itself; ask the shop for bleed or eyelets on top of it.
 */
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { getMission } from '../src/features/engine/missions';
import type { LinePath, Mission, Zone } from '../src/features/engine/types';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'print');

/** PDF points per centimetre. */
const CM = 72 / 2.54;

const INK = '#191b20';
const GRID = '#e1e4e8';
const GRID_MAJOR = '#c9cdd3';
const ZONE = '#8a929d';
const SIGNAL = '#ffb020';

interface Banner {
  file: string;
  mission: string;
  robot: string;
  level: string;
  colour: string;
  /** The empty space inside the track, in arena centimetres, where the legend goes. */
  legend: { x: number; y: number; w: number };
}

const banners: Banner[] = [
  {
    file: 'arena-ciko.pdf',
    mission: 'ciko-garis',
    robot: 'Ciko',
    level: 'SD · Pemula / Beginner',
    colour: '#e3262d',
    legend: { x: 56, y: 50, w: 88 },
  },
  {
    file: 'arena-momo.pdf',
    mission: 'momo-garis',
    robot: 'Momo',
    level: 'SMP · Menengah / Intermediate',
    colour: '#22b3a3',
    legend: { x: 58, y: 48, w: 84 },
  },
];

/** The DCTEdu wordmark, read from the file the ui package generates, so it never drifts. */
function readWordmark() {
  const source = readFileSync(
    join(here, '..', '..', '..', 'packages', 'ui', 'src', 'brand', 'wordmark-path.ts'),
    'utf8',
  );
  const viewBox = source.match(/wordmarkViewBox = '([^']+)'/)?.[1];
  const path = source.match(/wordmarkPath =\s*'([^']+)'/)?.[1];
  const dot = source.match(/cx: (-?\d+), cy: (-?\d+), r: (\d+)/);
  if (!viewBox || !path || !dot) throw new Error('Could not read the wordmark.');
  const [minX, minY, width, height] = viewBox.split(' ').map(Number) as [
    number,
    number,
    number,
    number,
  ];
  return {
    path,
    minX,
    minY,
    width,
    height,
    dot: { cx: Number(dot[1]), cy: Number(dot[2]), r: Number(dot[3]) },
  };
}

function grid(doc: PDFKit.PDFDocument, width: number, height: number) {
  // A line every 10 cm, a stronger one every 50 cm: the same squares as the simulator floor.
  for (let x = 10; x < width; x += 10) {
    doc
      .moveTo(x * CM, 0)
      .lineTo(x * CM, height * CM)
      .lineWidth((x % 50 === 0 ? 0.08 : 0.05) * CM)
      .strokeColor(x % 50 === 0 ? GRID_MAJOR : GRID)
      .stroke();
  }
  for (let y = 10; y < height; y += 10) {
    doc
      .moveTo(0, y * CM)
      .lineTo(width * CM, y * CM)
      .lineWidth((y % 50 === 0 ? 0.08 : 0.05) * CM)
      .strokeColor(y % 50 === 0 ? GRID_MAJOR : GRID)
      .stroke();
  }
}

function tape(doc: PDFKit.PDFDocument, line: LinePath) {
  const [first, ...rest] = line.points;
  if (!first) return;
  doc.moveTo(first.x * CM, first.y * CM);
  for (const point of rest) doc.lineTo(point.x * CM, point.y * CM);
  if (line.closed) doc.closePath();
  doc
    .lineWidth(line.width * CM)
    .lineJoin('round')
    .lineCap('round')
    .strokeColor(INK)
    .stroke();
}

function zone(doc: PDFKit.PDFDocument, entry: Zone, label: string) {
  doc
    .roundedRect(entry.x * CM, entry.y * CM, entry.w * CM, entry.h * CM, 1.5 * CM)
    .lineWidth(0.25 * CM)
    .dash(1.2 * CM, { space: 0.8 * CM })
    .strokeColor(entry.kind === 'finish' ? SIGNAL : ZONE)
    .stroke()
    .undash();
  // In the zone's top-left corner: the zone is centred on the tape, so its corners stay clear of
  // it, while a label below or beside the zone can land on the line.
  doc
    .font('Helvetica-Bold')
    .fontSize((entry.kind === 'finish' ? 2.2 : 3.2) * CM)
    .fillColor(entry.kind === 'finish' ? '#b97700' : ZONE)
    .text(label, (entry.x + 1.6) * CM, (entry.y + 1.4) * CM, { lineBreak: false });
}

/** Where the robot starts: an outline of its footprint, centred on the start pose, and an arrow. */
function start(doc: PDFKit.PDFDocument, mission: Mission, colour: string) {
  const { x, y, heading } = mission.start;
  const length = 16;
  const width = 13;
  doc
    .save()
    .translate(x * CM, y * CM)
    .rotate(heading);
  doc
    .roundedRect((-length / 2) * CM, (-width / 2) * CM, length * CM, width * CM, 2 * CM)
    .lineWidth(0.3 * CM)
    .strokeColor(colour)
    .stroke();
  doc
    .moveTo((length / 2 + 1.5) * CM, -2 * CM)
    .lineTo((length / 2 + 5) * CM, 0)
    .lineTo((length / 2 + 1.5) * CM, 2 * CM)
    .closePath()
    .fillColor(colour)
    .fill();
  doc.restore();
  doc
    .font('Helvetica-Bold')
    .fontSize(2.2 * CM)
    .fillColor(colour)
    .text('START', (x - length / 2) * CM, (y + width / 2 + 1) * CM, {
      width: length * CM,
      align: 'center',
      lineBreak: false,
    });
}

function legend(
  doc: PDFKit.PDFDocument,
  banner: Banner,
  mission: Mission,
  wordmark: ReturnType<typeof readWordmark>,
) {
  const { x, y, w } = banner.legend;
  const markWidth = w * 0.62;
  const scale = (markWidth * CM) / wordmark.width;
  doc
    .save()
    .translate(x * CM, y * CM)
    .scale(scale)
    .translate(-wordmark.minX, -wordmark.minY);
  doc.path(wordmark.path).fillColor(INK).fill();
  doc.circle(wordmark.dot.cx, wordmark.dot.cy, wordmark.dot.r).fillColor(SIGNAL).fill();
  doc.restore();

  const top = y + (wordmark.height * scale) / CM + 3;
  doc
    .font('Helvetica-Bold')
    .fontSize(4.6 * CM)
    .fillColor(banner.colour)
    .text(`Arena ${banner.robot}`, x * CM, top * CM, { width: w * CM, lineBreak: false });
  doc
    .font('Helvetica')
    .fontSize(2 * CM)
    .fillColor(INK)
    .text(
      `${banner.level}  ·  ${mission.arena.width} × ${mission.arena.height} cm`,
      x * CM,
      (top + 6.5) * CM,
      { width: w * CM, lineBreak: false },
    )
    .text(
      'Ikuti garis: start, 1, 2, 3, lalu finis. Sama dengan misi di simulator.',
      x * CM,
      (top + 10) * CM,
      { width: w * CM, lineBreak: false },
    )
    .fillColor(ZONE)
    .text(
      'Follow the line: start, 1, 2, 3, then finish. The same as the simulator mission.',
      x * CM,
      (top + 13) * CM,
      { width: w * CM, lineBreak: false },
    );

  // A 20 cm scale bar, to check the print came out at full size.
  const barTop = top + 18.5;
  doc
    .rect(x * CM, barTop * CM, 20 * CM, 0.6 * CM)
    .fillColor(INK)
    .fill();
  doc
    .font('Helvetica-Bold')
    .fontSize(1.8 * CM)
    .fillColor(INK)
    .text('20 cm', (x + 21.5) * CM, (barTop - 0.6) * CM, { lineBreak: false });
  doc
    .font('Helvetica')
    .fontSize(1.5 * CM)
    .fillColor(ZONE)
    .text(
      'Cetak 100 %, tanpa skala. Print at 100 %, no scaling.  ·  dctedu · PT Dharma Cipta Teknologi',
      x * CM,
      (barTop + 2) * CM,
      { width: w * CM, lineBreak: false },
    );
}

function draw(banner: Banner, wordmark: ReturnType<typeof readWordmark>): Promise<string> {
  const mission = getMission(banner.mission);
  if (!mission) throw new Error(`No mission ${banner.mission}`);
  const { width, height } = mission.arena;
  const doc = new PDFDocument({
    size: [width * CM, height * CM],
    margin: 0,
    info: {
      Title: `DCTEdu Arena ${banner.robot} (${width} × ${height} cm)`,
      Author: 'PT Dharma Cipta Teknologi',
      Subject: `Print-ready arena banner for ${banner.robot}, mission ${banner.mission}`,
    },
  });
  const path = join(out, banner.file);
  const done = new Promise<string>((resolve, reject) => {
    const stream = createWriteStream(path);
    stream.on('finish', () => resolve(path));
    stream.on('error', reject);
    doc.pipe(stream);
  });

  doc
    .rect(0, 0, width * CM, height * CM)
    .fillColor('#ffffff')
    .fill();
  grid(doc, width, height);
  // A colour strip on each short edge marks whose banner it is, clear of the track.
  doc
    .rect(0, 0, 1.2 * CM, height * CM)
    .fillColor(banner.colour)
    .fill();
  doc
    .rect((width - 1.2) * CM, 0, 1.2 * CM, height * CM)
    .fillColor(banner.colour)
    .fill();

  const labels: Record<string, string> = { c1: '1', c2: '2', c3: '3', lap: 'FINIS / FINISH' };
  for (const entry of mission.arena.zones) zone(doc, entry, labels[entry.id] ?? entry.id);
  for (const line of mission.arena.lines) tape(doc, line);
  start(doc, mission, banner.colour);
  legend(doc, banner, mission, wordmark);

  doc.end();
  return done;
}

mkdirSync(out, { recursive: true });
const wordmark = readWordmark();
for (const banner of banners) {
  // biome-ignore lint/suspicious/noConsole: the script reports what it wrote.
  console.log(`wrote ${await draw(banner, wordmark)}`);
}
