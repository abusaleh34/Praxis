'use client';
import { useEffect, useId, useState } from 'react';

const colors = ['#69d5be', '#f1c36c', '#b9a2ee'];
const rad = (n: number) => (n * Math.PI) / 180;
export function TriangleProof({ a, b, step }: { a: number; b: number; step: number }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    setProgress(step > 0 ? 100 : 0);
  }, [step]);
  // Intersect the rays at the two base angles, then fit the actual triangle.
  const h = 1 / (1 / Math.tan(rad(a)) + 1 / Math.tan(rad(b)));
  const cx = h / Math.tan(rad(a));
  const left = Math.min(0, cx),
    right = Math.max(1, cx);
  const scale = Math.min(350 / (right - left), 175 / h);
  const x = 240 - ((left + right) * scale) / 2;
  const points = [
    [x, 215],
    [x + scale, 215],
    [x + cx * scale, 215 - h * scale],
  ];
  const angles = [a, b, 180 - a - b],
    starts = [-a, -180, b];
  const joined = [-180, -180 + a, -180 + a + b];
  const t = progress / 100;
  return (
    <div className="proof-player">
      <svg
        viewBox="0 0 480 370"
        role="img"
        aria-label="برهان متحرك: ننقل الزوايا الثلاث دون تغيير قياسها لتجتمع على خط مستقيم"
      >
        <path
          d={`M${points[0].join(' ')}L${points[1].join(' ')}L${points[2].join(' ')}Z`}
          fill="none"
          stroke="#a7bbc8"
          strokeWidth="2"
        />
        <path d="M70 305H410" stroke="#a7bbc8" strokeWidth="2" opacity={t} />
        {angles.map((angle, i) => {
          const end = [44 * Math.cos(rad(angle)), 44 * Math.sin(rad(angle))];
          const rotation = starts[i] + (joined[i] - starts[i]) * t;
          return (
            <g
              key={i}
              className="moving-angle"
              style={{
                transform: `translate(${points[i][0] + (240 - points[i][0]) * t}px, ${points[i][1] + (305 - points[i][1]) * t}px) rotate(${rotation}deg)`,
              }}
            >
              <path
                d={`M0 0L44 0A44 44 0 0 1 ${end.join(' ')}Z`}
                fill={colors[i]}
                fillOpacity=".7"
                stroke={colors[i]}
                strokeWidth="2"
              />
              <g
                transform={`translate(${68 * Math.cos(rad(angle / 2))} ${68 * Math.sin(rad(angle / 2))})`}
              >
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${-rotation})`}
                  fill={colors[i]}
                  fontSize="17"
                >
                  {angle}°
                </text>
              </g>
            </g>
          );
        })}
        <text x="240" y="355" textAnchor="middle" fill="white" fontSize="19" opacity={t}>
          {a}° + {b}° + {180 - a - b}° = 180°
        </text>
      </svg>
      <label>
        اجمع الزوايا على المستقيم
        <input
          aria-label="جمع الزوايا"
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
        />
      </label>
      <p>كل لون زاوية من المثلث. ننقلها ونديرها مع ثبات قياسها.</p>
    </div>
  );
}

export function RectangleProof({
  a,
  b,
  step,
  target,
}: {
  a: number;
  b: number;
  step: number;
  target: 'area' | 'perimeter';
}) {
  const gridId = useId();
  const gridUnit = Math.max(1, 10 ** Math.ceil(Math.log10(Math.max(a, b) / 40)));
  const scale = Math.min(320 / a, 190 / b),
    w = a * scale,
    h = b * scale,
    x = (480 - w) / 2,
    y = (300 - h) / 2;
  return (
    <svg
      className="rectangle-proof"
      viewBox="0 0 480 360"
      role="img"
      aria-label={
        target === 'perimeter'
          ? 'نتتبع أضلاع المستطيل الأربعة لجمع المحيط'
          : `شبكة تغطي المساحة؛ ضلع المربع الكامل ${gridUnit} سم`
      }
    >
      <rect x={x} y={y} width={w} height={h} stroke="#a7bbc8" fill="#69d5be15" />
      {target === 'area' ? (
        <g opacity={step > 0 ? 1 : 0.15} className="proof-reveal">
          <defs>
            <pattern
              id={gridId}
              x={x}
              y={y}
              width={scale * gridUnit}
              height={scale * gridUnit}
              patternUnits="userSpaceOnUse"
            >
              <rect
                width={scale * gridUnit}
                height={scale * gridUnit}
                fill="#69d5be33"
                stroke="#69d5be"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect x={x} y={y} width={w} height={h} fill={`url(#${gridId})`} />
          <text x="240" y="305" fill="#a7bbc8" textAnchor="middle">
            كل مربع كامل: {gridUnit} × {gridUnit} سم
          </text>
        </g>
      ) : (
        <path
          className="perimeter-trace"
          d={`M${x} ${y}h${w}v${h}h${-w}Z`}
          pathLength="1"
          stroke="#f1c36c"
          strokeWidth="5"
          fill="none"
          strokeDasharray="1"
          strokeDashoffset={step > 0 ? 0 : 1}
        />
      )}
      <text x="240" y={y - 15} fill="#69d5be" textAnchor="middle" fontSize="20">
        {a} سم
      </text>
      <text x={x + w + 12} y="150" fill="#f1c36c" fontSize="18">
        {b}
      </text>
      {target === 'perimeter' && step > 0 && (
        <>
          <text x="240" y={y + h + 26} fill="#69d5be" textAnchor="middle">
            {a} سم
          </text>
          <text x={x - 25} y="150" fill="#f1c36c">
            {b}
          </text>
        </>
      )}
      <text x="240" y="337" textAnchor="middle" fill="white" fontSize="20">
        {step === 2
          ? target === 'area'
            ? `${a} × ${b} = ${a * b} سم²`
            : `${a} + ${b} + ${a} + ${b} = ${2 * (a + b)} سم`
          : target === 'area'
            ? 'نعدّ مربعات الداخل'
            : 'نتتبع طول الحدود'}
      </text>
    </svg>
  );
}
