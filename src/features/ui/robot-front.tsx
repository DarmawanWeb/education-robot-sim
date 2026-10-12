import type { Face, RobotId } from '../engine/types';

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

function Transducer({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="15" fill="#c3c9d1" stroke="#7d8590" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r="11" fill="#9aa1ab" />
      <circle cx={cx} cy={cy} r="7.5" fill="none" stroke="#7d8590" strokeWidth="1" />
      <circle cx={cx} cy={cy} r="4" fill="none" stroke="#7d8590" strokeWidth="1" />
    </g>
  );
}

/**
 * The robot seen from the front, as it sits on the classroom floor. SD v1 shows its blue face
 * housing with the ultrasonic sensor on top and the two IR sensors underneath; SMP v1 shows its
 * SSD1306 OLED board. The screen mirrors what the program draws.
 */
export function RobotFront({
  robot,
  face,
  oled,
  lineSeen,
  label,
}: {
  robot: RobotId;
  face: Face;
  oled: readonly string[];
  /** Whether each IR sensor sees the tape, left to right. */
  lineSeen: readonly boolean[];
  label: string;
}) {
  if (robot === 'sd') {
    return (
      <svg viewBox="0 0 160 124" role="img" aria-label={label} className="h-auto w-full">
        <rect x="42" y="4" width="76" height="34" rx="8" fill="#1a4fb4" />
        <Transducer cx={61} cy={21} />
        <Transducer cx={99} cy={21} />
        <rect
          x="8"
          y="32"
          width="144"
          height="76"
          rx="16"
          fill="#2263da"
          stroke="#123a8b"
          strokeWidth="2"
        />
        <rect
          x="18"
          y="41"
          width="124"
          height="58"
          rx="10"
          fill="none"
          stroke="#ffcd1c"
          strokeWidth="5"
        />
        {[
          [20, 43],
          [140, 43],
        ].map(([cx, cy]) => (
          <circle key={cx} cx={cx} cy={cy} r="3.2" fill="#d5d9de" />
        ))}
        <rect x="27" y="48" width="106" height="45" rx="5" fill="#000000" />
        <svg x="30" y="50" width="100" height="41" viewBox="0 0 128 64" aria-hidden>
          <OledContent face={face} lines={oled} />
        </svg>
        {[0, 1].map((index) => {
          const x = index === 0 ? 30 : 108;
          const on = lineSeen[index] ?? false;
          return (
            <g key={x}>
              <rect
                x={x}
                y="104"
                width="22"
                height="16"
                rx="3"
                fill="#f5c518"
                stroke="#a77f00"
                strokeWidth="1.2"
              />
              <circle cx={x + 11} cy="114" r="4.5" fill={on ? '#ff3b30' : '#202020'} />
              {on ? <circle cx={x + 11} cy="114" r="8" fill="#ff3b30" opacity="0.3" /> : null}
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
