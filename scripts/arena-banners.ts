/**
 * Draws the arena banners we sell as print-ready PDFs at full size, one per robot, from the same
 * geometry as the simulator's Arena challenge missions (`ciko-arena`, `momo-arena`): a program
 * that finishes the mission on screen can be run on the banner as it is.
 *
 *   pnpm --filter @dctedu/simulator arena:pdf      writes print/arena-<robot>.pdf
 *
 * Everything is vector and measured in centimetres, so the print shop prints at 100 % with no
 * scaling. The page is the banner itself; ask the shop for bleed or eyelets on top of it.
 *
 * A real robot reads the banner with infrared sensors, so only the tape is dark. Zones, labels,
 * and the start mark are pale, and labels sit in the corner of their zone farthest from the tape.
 */
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { distanceToPath } from '../src/features/engine/geometry';
import { getMission } from '../src/features/engine/missions';
import type { LinePath, Mission, Vec, Zone } from '../src/features/engine/types';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'print');

/** PDF points per centimetre. */
const CM = 72 / 2.54;

const INK = '#191b20';
const MUTED = '#5a606c';
const GRID = '#e4e7eb';
const GRID_MAJOR = '#d3d7dc';
const ZONE = '#b9c9da';
const ZONE_TEXT = '#9fb2c6';
const FINISH = '#ffd27a';
const FINISH_TEXT = '#e0a43a';
const SIGNAL = '#ffb020';

/** A block of text on the banner: where it starts and how wide it may run, in centimetres. */
interface Area {
  x: number;
  y: number;
  w: number;
}

interface Banner {
  file: string;
  mission: string;
  robot: string;
  level: string;
  /** The robot's colour, for the edges and the title. */
  colour: string;
  /** A pale tint of it, for the start mark, which the sensors pass over. */
  tint: string;
  /** Seconds for one lap, from the mission. */
  seconds: number;
  /** The free wedges above and below the crossing, where the legend goes. */
  top: Area;
  bottom: Area;
}

const banners: Banner[] = [
  {
    file: 'arena-ciko.pdf',
    mission: 'ciko-arena',
    robot: 'Ciko',
    level: 'SD · Pemula / Beginner',
    colour: '#e3262d',
    tint: '#f6b3b5',
    seconds: 70,
    top: { x: 76, y: 4, w: 48 },
    bottom: { x: 72, y: 107, w: 56 },
  },
  {
    file: 'arena-momo.pdf',
    mission: 'momo-arena',
    robot: 'Momo',
    level: 'SMP · Menengah / Intermediate',
    colour: '#22b3a3',
    tint: '#a7e2db',
    seconds: 32,
    top: { x: 76, y: 4, w: 48 },
    bottom: { x: 76, y: 101, w: 52 },
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
type Wordmark = ReturnType<typeof readWordmark>;

function grid(doc: PDFKit.PDFDocument, width: number, height: number) {
  // A line every 10 cm, a stronger one every 50 cm: the same squares as the simulator floor.
  const rule = (major: boolean) =>
    doc
      .lineWidth((major ? 0.08 : 0.05) * CM)
      .strokeColor(major ? GRID_MAJOR : GRID)
      .stroke();
  for (let x = 10; x < width; x += 10) {
    doc.moveTo(x * CM, 0).lineTo(x * CM, height * CM);
    rule(x % 50 === 0);
  }
  for (let y = 10; y < height; y += 10) {
    doc.moveTo(0, y * CM).lineTo(width * CM, y * CM);
    rule(y % 50 === 0);
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

/** The corner of a zone farthest from every tape, where its label cannot meet a sensor. */
function clearCorner(entry: Zone, lines: readonly LinePath[]): Vec & { right: boolean } {
  const inset = 2;
  const corners = [
    { x: entry.x + inset, y: entry.y + inset, right: false },
    { x: entry.x + entry.w - inset, y: entry.y + inset, right: true },
    { x: entry.x + inset, y: entry.y + entry.h - inset, right: false },
    { x: entry.x + entry.w - inset, y: entry.y + entry.h - inset, right: true },
  ];
  const clearance = (point: Vec) => Math.min(...lines.map((line) => distanceToPath(point, line)));
  return corners.reduce((best, corner) => (clearance(corner) > clearance(best) ? corner : best));
}

function zone(doc: PDFKit.PDFDocument, entry: Zone, label: string, lines: readonly LinePath[]) {
  const finish = entry.kind === 'finish';
  doc
    .roundedRect(entry.x * CM, entry.y * CM, entry.w * CM, entry.h * CM, 1.5 * CM)
    .lineWidth(0.2 * CM)
    .dash(1.2 * CM, { space: 0.8 * CM })
    .strokeColor(finish ? FINISH : ZONE)
    .stroke()
    .undash();
  const size = (finish ? 1.8 : 3) * CM;
  doc.font('Helvetica-Bold').fontSize(size);
  const corner = clearCorner(entry, lines);
  const width = doc.widthOfString(label);
  const height = doc.currentLineHeight();
  const top = corner.y * CM - (corner.y > entry.y + entry.h / 2 ? height : 0);
  doc
    .fillColor(finish ? FINISH_TEXT : ZONE_TEXT)
    .text(label, corner.x * CM - (corner.right ? width : 0), top, { lineBreak: false });
}

/** Where the robot starts: a pale outline of its footprint, and an arrow beside it. */
function start(doc: PDFKit.PDFDocument, mission: Mission, banner: Banner) {
  const { x, y, heading } = mission.start;
  const length = mission.robot === 'ciko' ? 16 : 18;
  const width = mission.robot === 'ciko' ? 13 : 14;
  doc
    .save()
    .translate(x * CM, y * CM)
    .rotate((heading * 180) / Math.PI);
  doc
    .roundedRect((-length / 2) * CM, (-width / 2) * CM, length * CM, width * CM, 2 * CM)
    .lineWidth(0.25 * CM)
    .strokeColor(banner.tint)
    .stroke();
  // The arrow runs alongside the footprint, clear of the tape under the robot.
  const side = width / 2 + 3;
  doc
    .moveTo((-length / 2) * CM, side * CM)
    .lineTo((length / 2) * CM, side * CM)
    .lineWidth(0.4 * CM)
    .strokeColor(banner.colour)
    .stroke();
  doc
    .moveTo((length / 2) * CM, (side - 1.6) * CM)
    .lineTo((length / 2 + 3) * CM, side * CM)
    .lineTo((length / 2) * CM, (side + 1.6) * CM)
    .closePath()
    .fillColor(banner.colour)
    .fill();
  doc.restore();
  // The word sits just past the arrow, on the same side of the tape, upright whatever the heading.
  const reach = side + 3;
  const centre = { x: x - reach * Math.sin(heading), y: y + reach * Math.cos(heading) };
  doc
    .font('Helvetica-Bold')
    .fontSize(2 * CM)
    .fillColor(banner.colour);
  doc.text(
    'START',
    centre.x * CM - doc.widthOfString('START') / 2,
    centre.y * CM - doc.currentLineHeight() / 2,
    { lineBreak: false },
  );
}

function title(doc: PDFKit.PDFDocument, banner: Banner, mission: Mission, wordmark: Wordmark) {
  const { x, y, w } = banner.top;
  const markWidth = w * 0.86;
  const scale = (markWidth * CM) / wordmark.width;
  doc
    .save()
    .translate(x * CM, y * CM)
    .scale(scale)
    .translate(-wordmark.minX, -wordmark.minY);
  doc.path(wordmark.path).fillColor(INK).fill();
  doc.circle(wordmark.dot.cx, wordmark.dot.cy, wordmark.dot.r).fillColor(SIGNAL).fill();
  doc.restore();

  const below = y + (wordmark.height * scale) / CM + 2;
  doc
    .font('Helvetica-Bold')
    .fontSize(4.4 * CM)
    .fillColor(banner.colour)
    .text(`Arena ${banner.robot}`, x * CM, below * CM, { width: w * CM, lineBreak: false });
  doc
    .font('Helvetica')
    .fontSize(1.7 * CM)
    .fillColor(MUTED)
    .text(
      `${banner.level}  ·  ${mission.arena.width} × ${mission.arena.height} cm`,
      x * CM,
      (below + 5.5) * CM,
      { width: w * CM, lineBreak: false },
    );
}

function rules(doc: PDFKit.PDFDocument, banner: Banner) {
  const { x, y, w } = banner.bottom;
  const line = (text: string, at: number, size: number, colour: string, bold = false) =>
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(size * CM)
      .fillColor(colour)
      .text(text, x * CM, (y + at) * CM, { width: w * CM, lineBreak: false });

  line('TANTANGAN ARENA / ARENA CHALLENGE', 0, 2, INK, true);
  line(`Satu putaran, maksimal ${banner.seconds} detik:`, 3.4, 1.7, INK);
  line('start, 1, 2, 3, lalu kembali ke finis.', 5.9, 1.7, INK);
  line(`One lap in ${banner.seconds} seconds or less:`, 8.9, 1.6, MUTED);
  line('start, 1, 2, 3, then back to the finish.', 11.2, 1.6, MUTED);
  line('Sama dengan misi Tantangan arena di simulator.', 14.2, 1.4, MUTED);

  // A 20 cm scale bar, to check the print came out at full size.
  const bar = y + 18;
  doc
    .rect(x * CM, bar * CM, 20 * CM, 0.6 * CM)
    .fillColor(INK)
    .fill();
  doc
    .font('Helvetica-Bold')
    .fontSize(1.6 * CM)
    .fillColor(INK)
    .text('20 cm', (x + 21.5) * CM, (bar - 0.5) * CM, { lineBreak: false });
  line('Cetak 100 %, tanpa skala. Print at 100 %, no scaling.', 20.5, 1.2, MUTED);
  line('DCTEdu · PT Dharma Cipta Teknologi', 22.5, 1.2, MUTED);
}

function draw(banner: Banner, wordmark: Wordmark): Promise<string> {
  const mission = getMission(banner.mission);
  if (!mission) throw new Error(`No mission ${banner.mission}`);
  if (mission.timeLimit !== banner.seconds)
    throw new Error(`${banner.mission} allows ${mission.timeLimit} s, not ${banner.seconds} s.`);
  const { width, height, lines, zones } = mission.arena;
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
  for (const entry of zones) zone(doc, entry, labels[entry.id] ?? entry.id, lines);
  start(doc, mission, banner);
  for (const line of lines) tape(doc, line);
  title(doc, banner, mission, wordmark);
  rules(doc, banner);

  doc.end();
  return done;
}

mkdirSync(out, { recursive: true });
const wordmark = readWordmark();
for (const banner of banners) {
  // biome-ignore lint/suspicious/noConsole: the script reports what it wrote.
  console.log(`wrote ${await draw(banner, wordmark)}`);
}
