import type { Face, RobotId } from '../engine/types';
import type { SignalLamps } from './robot-sprite';

const PIXEL = '#7ff3ff';
const ROWS = [0, 1, 2, 3] as const;

/** The OLED content: a face from the preset expressions, or up to four lines of text. */
function OledContent({ face, lines }: { face: Face; lines: readonly string[] }) {
  if (lines.some((line) => line.trim().length > 0)) {
    return (
      <g
        fill={PIXEL}
        fontFamily="'Atkinson Hyperlegible Mono Variable', ui-monospace, monospace"
        fontSize="10.5"
      >
        {ROWS.map((row) => (
          <text key={row} x="3" y={13 + row * 15} xmlSpace="preserve">
            {lines[row] ?? ''}
          </text>
        ))}
      </g>
    );
  }
  const eyes =
    face === 'senang' || face === 'berhasil' ? (
      <g fill="none" stroke={PIXEL} strokeWidth="6" strokeLinecap="round">
        <path d="M30 38q12-18 24 0" />
        <path d="M74 38q12-18 24 0" />
      </g>
    ) : face === 'waspada' ? (
      <g fill={PIXEL}>
        <rect x="32" y="24" width="20" height="22" rx="4" />
        <rect x="76" y="24" width="20" height="22" rx="4" />
        <path d="M28 18l26 6M100 18l-26 6" stroke={PIXEL} strokeWidth="4" strokeLinecap="round" />
      </g>
    ) : face === 'bingung' ? (
      <g fill={PIXEL}>
        <rect x="30" y="20" width="24" height="24" rx="5" />
        <rect x="78" y="28" width="16" height="16" rx="4" />
        <text x="102" y="22" fontSize="16" fontWeight="700">
          ?
        </text>
      </g>
    ) : (
      <g fill={PIXEL}>
        <rect x="30" y="18" width="24" height="26" rx="6" />
        <rect x="74" y="18" width="24" height="26" rx="6" />
      </g>
    );
  return (
    <>
      {eyes}
      {face === 'berhasil' ? (
        <path
          d="M54 52l7 6 13-12"
          fill="none"
          stroke={PIXEL}
          strokeWidth="4"
          strokeLinecap="round"
        />
      ) : null}
    </>
  );
}

/** An HC-SR04 transducer seen head-on. */
function Transducer({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#c3c9d1" stroke="#7d8590" strokeWidth={r / 10} />
      <circle cx={cx} cy={cy} r={r * 0.73} fill="#9aa1ab" />
      <circle cx={cx} cy={cy} r={r * 0.5} fill="none" stroke="#7d8590" strokeWidth={r / 15} />
      <circle cx={cx} cy={cy} r={r * 0.27} fill="none" stroke="#7d8590" strokeWidth={r / 15} />
    </g>
  );
}

/** An orange turn-signal LED, glowing while lit. */
function Lamp({ cx, cy, lit }: { cx: number; cy: number; lit: boolean }) {
  return (
    <g>
      {lit ? (
        <>
          <circle cx={cx} cy={cy} r="14" fill="#ffa31a" opacity="0.22" />
          <circle cx={cx} cy={cy} r="8.5" fill="#ffa31a" opacity="0.45" />
        </>
      ) : null}
      <circle cx={cx} cy={cy} r="5" fill={lit ? '#ffb020' : '#8a4a10'} />
      <circle cx={cx} cy={cy} r="3.4" fill={lit ? '#fff1c1' : '#d9822b'} />
    </g>
  );
}

/**
 * The robot seen from the front, as it sits on the classroom floor. SD v1 shows its red shell
 * and white stripe, the OLED eyes behind the black visor, the HC-SR04 in its bumper, the two
 * turn signals, and the IR sensors on the chin; SMP v1 shows its SSD1306 OLED board. Left
 * parts are drawn on the left, as the student thinks of them. The screen mirrors the program.
 */
export function RobotFront({
  robot,
  face,
  oled,
  lineSeen,
  lamps = { left: false, right: false },
  label,
}: {
  robot: RobotId;
  face: Face;
  oled: readonly string[];
  /** Whether each IR sensor sees the tape, left to right. */
  lineSeen: readonly boolean[];
  /** Which turn-signal LEDs are lit (SD v1). */
  lamps?: SignalLamps;
  label: string;
}) {
  if (robot === 'sd') {
    return (
      <svg viewBox="0 0 160 124" role="img" aria-label={label} className="h-auto w-full">
        <ellipse cx="80" cy="120" rx="74" ry="3.5" fill="#000000" opacity="0.12" />
        {[0, 146].map((x) => (
          <g key={x}>
            <rect x={x} y="58" width="14" height="62" rx="6" fill="#1b1b1b" />
            {[70, 82, 94, 106].map((y) => (
              <path key={y} d={`M${x + 2} ${y}h10`} stroke="#3a3a3a" strokeWidth="2" />
            ))}
          </g>
        ))}
        <path
          d="M24 66V26Q24 8 44 8H116Q136 8 136 26V66Z"
          fill="#d4252c"
          stroke="#8c1218"
          strokeWidth="2"
        />
        <rect x="68" y="9" width="24" height="6" fill="#f5f5f0" />
        <rect x="30" y="15" width="100" height="42" rx="8" fill="#0d0f14" />
        <svg x="34" y="18" width="92" height="37" viewBox="0 8 128 52" aria-hidden>
          <OledContent face={face} lines={oled} />
        </svg>
        <path
          d="M38 19.5h84"
          stroke="#ffffff"
          strokeOpacity="0.14"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M10 106V80Q10 58 32 58H128Q150 58 150 80V106Z"
          fill="#d4252c"
          stroke="#8c1218"
          strokeWidth="2"
        />
        <rect x="68" y="59" width="24" height="15" fill="#f5f5f0" />
        <rect
          x="46"
          y="74"
          width="68"
          height="30"
          rx="4"
          fill="#b0191f"
          stroke="#7d0f14"
          strokeWidth="1.5"
        />
        <rect x="50" y="78" width="60" height="22" rx="2" fill="#262626" />
        <Transducer cx={66} cy={89} r={10} />
        <Transducer cx={94} cy={89} r={10} />
        <Lamp cx={25} cy={92} lit={lamps.left} />
        <Lamp cx={135} cy={92} lit={lamps.right} />
        <rect x="16" y="105" width="128" height="4" rx="2" fill="#c9ced4" />
        <rect x="52" y="109" width="56" height="7" rx="2" fill="#1c1d1f" />
        {[63, 97].map((cx, index) => {
          const on = lineSeen[index] ?? false;
          return (
            <g key={cx}>
              {on ? <circle cx={cx} cy="112.5" r="7" fill="#ff3b30" opacity="0.3" /> : null}
              <circle cx={cx} cy="112.5" r="3" fill={on ? '#ff3b30' : '#3a3a3a'} />
            </g>
          );
        })}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 124" role="img" aria-label={label} className="h-auto w-full">
      <rect x="8" y="4" width="144" height="116" rx="8" fill="#1d4fb8" />
      {[
        [17, 13],
        [143, 13],
        [17, 111],
        [143, 111],
      ].map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="4.5"
          fill="#1d4fb8"
          stroke="#d5d9de"
          strokeWidth="2"
        />
      ))}
      {['GND', 'VCC', 'SCL', 'SDA'].map((pin, index) => (
        <g key={pin}>
          <rect x={52 + index * 16} y="8" width="9" height="9" fill="#d8b04a" />
          <text
            x={56.5 + index * 16}
            y="25"
            fontSize="5.5"
            fill="#e8eefb"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
          >
            {pin}
          </text>
        </g>
      ))}
      <rect x="14" y="30" width="132" height="72" rx="3" fill="#050505" />
      <svg x="18" y="34" width="124" height="64" viewBox="0 0 128 64" aria-hidden>
        <OledContent face={face} lines={oled} />
      </svg>
    </svg>
  );
}
