'use client';
import { useId } from 'react';
import type { Diagram } from '@/lib/types';
type Point = { x: number; y: number };
const mint = '#69d5be',
  gold = '#f1c36c',
  violet = '#b9a2ee',
  line = '#a7bbc8';
function fitTriangle(a: number, b: number, width = 350) {
  const h = 1 / (1 / Math.tan((a * Math.PI) / 180) + 1 / Math.tan((b * Math.PI) / 180));
  const cx = h / Math.tan((a * Math.PI) / 180),
    s = Math.min(width, 245 / h);
  return [
    { x: 280 - s / 2, y: 220 + (h * s) / 2 },
    { x: 280 + s / 2, y: 220 + (h * s) / 2 },
    { x: 280 + (cx - 0.5) * s, y: 220 - (h * s) / 2 },
  ];
}
function arcData(v: Point, p: Point, q: Point, r = 38) {
  const a = Math.atan2(p.y - v.y, p.x - v.x),
    b = Math.atan2(q.y - v.y, q.x - v.x);
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const end = a + delta;
  return {
    d: `M${v.x},${v.y}L${v.x + r * Math.cos(a)},${v.y + r * Math.sin(a)}A${r},${r} 0 0 ${delta > 0 ? 1 : 0} ${v.x + r * Math.cos(end)},${v.y + r * Math.sin(end)}Z`,
    label: {
      x: v.x + (r + 26) * Math.cos(a + delta / 2),
      y: v.y + (r + 26) * Math.sin(a + delta / 2),
    },
  };
}
function Angle({
  v,
  p,
  q,
  label,
  color = violet,
  active = false,
  r = 38,
}: {
  v: Point;
  p: Point;
  q: Point;
  label: string;
  color?: string;
  active?: boolean;
  r?: number;
}) {
  const a = arcData(v, p, q, r);
  return (
    <g>
      <path
        d={a.d}
        fill={color}
        fillOpacity={active ? 0.3 : 0.1}
        stroke={color}
        strokeWidth={active ? 3 : 1.5}
        className="geo-transition"
      />
      <text
        x={a.label.x}
        y={a.label.y}
        fill={color}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="22"
      >
        {label}
      </text>
    </g>
  );
}
function Segment({
  a,
  b,
  active = false,
  color = line,
}: {
  a: Point;
  b: Point;
  active?: boolean;
  color?: string;
}) {
  return (
    <line
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      stroke={active ? mint : color}
      strokeWidth={active ? 3.5 : 2}
      className="geo-transition"
    />
  );
}
function Tick({ a, b }: { a: Point; b: Point }) {
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    dx = b.x - a.x,
    dy = b.y - a.y,
    l = Math.hypot(dx, dy);
  return (
    <line
      x1={m.x - (dy / l) * 7}
      x2={m.x + (dy / l) * 7}
      y1={m.y + (dx / l) * 7}
      y2={m.y - (dx / l) * 7}
      stroke={gold}
      strokeWidth="2"
    />
  );
}
export function Geometry({
  diagram: d,
  highlight = '',
  compact = false,
}: {
  diagram: Diagram;
  highlight?: string;
  compact?: boolean;
}) {
  const id = useId().replaceAll(':', '');
  const active = (name: string) => highlight === 'all' || highlight === name;
  let drawing: React.ReactNode;
  if (['triangle', 'isosceles', 'exterior'].includes(d.type)) {
    const a = d.type === 'isosceles' ? (180 - Number(d.apex)) / 2 : Number(d.a),
      b = d.type === 'isosceles' ? a : Number(d.b);
    const [A, B, C] = fitTriangle(a, b, d.type === 'exterior' ? 295 : 350);
    drawing = (
      <>
        <path d={`M${A.x},${A.y}L${B.x},${B.y}L${C.x},${C.y}Z`} fill={mint} fillOpacity=".025" />
        <Segment a={A} b={B} />
        <Segment a={A} b={C} active={active('sides')} />
        <Segment a={B} b={C} active={active('sides')} />
        {d.type === 'isosceles' ? (
          <>
            <Tick a={A} b={C} />
            <Tick a={B} b={C} />
            <Angle v={C} p={A} q={B} label={`${d.apex}°`} color={gold} active={active('known')} />
            <Angle v={A} p={B} q={C} label="س" active={active('target')} />
            <Angle v={B} p={A} q={C} label="؟" color={mint} active={active('target')} />
          </>
        ) : d.type === 'exterior' ? (
          <>
            <Segment a={B} b={{ x: B.x + 90, y: B.y }} />
            <Angle v={A} p={B} q={C} label={`${a}°`} color={mint} active={active('known')} />
            <Angle v={C} p={A} q={B} label={`${d.c}°`} color={gold} active={active('known')} />
            <Angle v={B} p={C} q={{ x: B.x + 100, y: B.y }} label="س" active={active('target')} />
          </>
        ) : (
          <>
            <Angle v={A} p={B} q={C} label={`${a}°`} color={mint} active={active('known')} />
            <Angle v={B} p={A} q={C} label={`${b}°`} color={gold} active={active('known')} />
            <Angle v={C} p={A} q={B} label="س" active={active('target')} />
          </>
        )}
      </>
    );
  } else if (d.type === 'parallel') {
    const a = (Number(d.a) * Math.PI) / 180,
      cot = 1 / Math.tan(a),
      P = { x: 280 + 75 * cot, y: 130 },
      Q = { x: 280 - 75 * cot, y: 280 };
    drawing = (
      <>
        <Segment a={{ x: 55, y: 130 }} b={{ x: 505, y: 130 }} active={active('lines')} />
        <Segment a={{ x: 55, y: 280 }} b={{ x: 505, y: 280 }} active={active('lines')} />
        <path d="m100 123 8 7-8 7m0 136 8 7-8 7" fill="none" stroke={mint} strokeWidth="2" />
        <Segment a={{ x: 280 + 170 * cot, y: 35 }} b={{ x: 280 - 170 * cot, y: 375 }} />
        <Angle
          v={P}
          p={{ x: P.x + 100, y: P.y }}
          q={{ x: P.x + 100 * Math.cos(a), y: P.y - 100 * Math.sin(a) }}
          label={`${d.a}°`}
          color={gold}
          active={active('known')}
        />
        <Angle
          v={Q}
          p={{ x: Q.x + 100, y: Q.y }}
          q={{ x: Q.x + 100 * Math.cos(a), y: Q.y - 100 * Math.sin(a) }}
          label="س"
          active={active('target')}
        />
      </>
    );
  } else if (d.type === 'rectangle') {
    const l = Number(d.length),
      w = Number(d.width),
      s = Math.min(350 / l, 220 / w),
      x = 280 - (l * s) / 2,
      y = 205 - (w * s) / 2;
    drawing = (
      <>
        <rect
          x={x}
          y={y}
          width={l * s}
          height={w * s}
          fill={mint}
          fillOpacity={active('area') ? 0.24 : 0.055}
          stroke={active('sides') ? mint : line}
          strokeWidth="2.5"
          className="geo-transition"
        />
        <path d={`M${x + 18} ${y}v18h-18`} fill="none" stroke={line} />
        <text x="280" y={y + w * s + 36} textAnchor="middle" fill={mint} fontSize="23">
          {l} cm
        </text>
        <text x={x - 15} y="210" textAnchor="end" fill={gold} fontSize="23">
          {w} cm
        </text>
        <text x="280" y="211" textAnchor="middle" fill={violet} fontSize="34">
          ؟
        </text>
      </>
    );
  } else if (d.type === 'right') {
    const a = Number(d.a),
      b = Number(d.b),
      s = Math.min(330 / a, 225 / b),
      A = { x: 280 - (a * s) / 2, y: 210 + (b * s) / 2 },
      B = { x: 280 + (a * s) / 2, y: 210 + (b * s) / 2 },
      C = { x: 280 - (a * s) / 2, y: 210 - (b * s) / 2 };
    drawing = (
      <>
        <Segment a={A} b={B} active={active('sides')} />
        <Segment a={A} b={C} active={active('sides')} />
        <Segment a={B} b={C} active={active('target')} color={violet} />
        <path d={`M${A.x} ${A.y - 20}h20v20`} stroke={gold} fill="none" />
        <text x="280" y={A.y + 33} textAnchor="middle" fill={mint} fontSize="24">
          {a} cm
        </text>
        <text x={A.x - 18} y="215" textAnchor="end" fill={gold} fontSize="24">
          {b} cm
        </text>
        <text x="300" y="200" fill={violet} fontSize="27">
          س
        </text>
      </>
    );
  } else if (d.type === 'circle') {
    const a = (Number(d.central) * Math.PI) / 180,
      r = 128,
      O = { x: 280, y: 205 },
      T = { x: 280, y: 77 },
      A = { x: 280 + r * Math.sin(a / 2), y: 205 + r * Math.cos(a / 2) },
      B = { x: 280 - r * Math.sin(a / 2), y: 205 + r * Math.cos(a / 2) };
    drawing = (
      <>
        <circle cx={O.x} cy={O.y} r={r} fill="#ffffff02" stroke={line} strokeWidth="2" />
        <Segment a={T} b={A} active={active('target')} />
        <Segment a={T} b={B} active={active('target')} />
        <Segment a={O} b={A} active={active('known')} />
        <Segment a={O} b={B} active={active('known')} />
        <path
          d={`M${A.x} ${A.y}A${r} ${r} 0 0 1 ${B.x} ${B.y}`}
          fill="none"
          stroke={gold}
          strokeWidth={active('arc') ? 7 : 4}
        />
        <Angle
          v={O}
          p={A}
          q={B}
          label={`${d.central}°`}
          color={gold}
          r={30}
          active={active('known')}
        />
        <Angle v={T} p={A} q={B} label="س" r={30} active={active('target')} />
        <circle cx="280" cy="205" r="4" fill={mint} />
        <text x="265" y="192" fill={mint} fontSize="19">
          O
        </text>
      </>
    );
  } else {
    const n = Number(d.n),
      points = Array.from({ length: n }, (_, i) => ({
        x: 280 + 133 * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / n),
        y: 203 + 133 * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / n),
      }));
    drawing = (
      <>
        <polygon
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill={mint}
          fillOpacity=".035"
          stroke={active('all') ? mint : line}
          strokeWidth="2.3"
        />
        <Angle
          v={points[0]}
          p={points[1]}
          q={points[n - 1]}
          label="س"
          r={32}
          active={active('target')}
        />
        <text x="280" y="241" textAnchor="middle" fill={mint} fontSize="28">
          n = {n}
        </text>
        <text
          x="280"
          y="376"
          textAnchor="middle"
          fill="#8da2b2"
          fontSize="18"
          style={{ fontFamily: 'inherit' }}
        >
          مضلع منتظم
        </text>
      </>
    );
  }
  return (
    <svg
      className={`geometry ${compact ? 'compact' : ''}`}
      viewBox="0 0 560 410"
      role="img"
      aria-labelledby={id + 'title'}
    >
      <title id={id + 'title'}>رسم هندسي للسؤال، مع تمييز المعطيات والزاوية المطلوبة</title>
      <defs>
        <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" fill="none" stroke="#ffffff" strokeOpacity=".035" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="560" height="410" fill={`url(#${id})`} />
      {drawing}
    </svg>
  );
}
