/**
 * The filtering graph: input height left to right, output height bottom to top. Drag points,
 * click empty space to add one, double-click (or Alt-click) a point to remove it.
 */
import { useMemo, useRef } from 'react';
import { useHint } from '@/ui/kit';
import { buildCurveLUT, type CurvePoint, type FilterCurve } from '@/terrain';
import { capturePointer } from './capture';

interface Props {
  curve: FilterCurve;
  onChange(c: FilterCurve): void;
  histogram: Uint32Array | null;
  /** CSS gradient for the axis bars (low to high). */
  rampCss: string;
}

const PICK = 0.06;

/** SVG path of a curve in a 0..100 box (y up). */
export function curvePath(curve: FilterCurve, samples = 96): string {
  const lut = buildCurveLUT(curve, samples);
  let d = '';
  for (let i = 0; i < samples; i++) d += `${i ? 'L' : 'M'}${((i / (samples - 1)) * 100).toFixed(2)},${(100 - lut[i] * 100).toFixed(2)}`;
  return d;
}

export function CurveEditor({ curve, onChange, histogram, rampCss }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<number | null>(null);
  const curveRef = useRef(curve);
  curveRef.current = curve;
  const hint = useHint('Filtering graph: drag points, click to add one, double-click or Alt-click a point to remove it');

  const bars = useMemo(() => {
    if (!histogram) return [];
    let max = 1;
    for (const c of histogram) max = Math.max(max, c);
    const w = 100 / histogram.length;
    return Array.from(histogram, (c, i) => ({ x: i * w, w, h: Math.sqrt(c / max) * 92 }));
  }, [histogram]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)),
    };
  };

  const nearest = (x: number, y: number) => {
    let best = -1;
    let bd = PICK;
    curveRef.current.points.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };

  const remove = (i: number) => {
    const pts = curveRef.current.points;
    if (pts.length <= 2) return;
    onChange({ ...curveRef.current, points: pts.filter((_, k) => k !== i) });
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const { x, y } = local(e);
    const i = nearest(x, y);
    if (i >= 0 && e.altKey) {
      remove(i);
      return;
    }
    capturePointer(e.currentTarget, e.pointerId);
    if (i >= 0) {
      dragRef.current = i;
      return;
    }
    const pts = [...curveRef.current.points, { x, y }].sort((a, b) => a.x - b.x);
    dragRef.current = pts.findIndex((p) => p.x === x && p.y === y);
    onChange({ ...curveRef.current, points: pts });
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const i = dragRef.current;
    if (i === null) return;
    const { x, y } = local(e);
    const pts: CurvePoint[] = curveRef.current.points.map((p) => ({ ...p }));
    const lo = i > 0 ? pts[i - 1].x + 0.005 : 0;
    const hi = i < pts.length - 1 ? pts[i + 1].x - 0.005 : 1;
    pts[i] = { x: Math.min(hi, Math.max(lo, x)), y };
    onChange({ ...curveRef.current, points: pts });
  };

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const { x, y } = local(e);
    const i = nearest(x, y);
    if (i >= 0) remove(i);
  };

  return (
    <div className="te-curve">
      <div className="te-curve__yaxis" style={{ background: rampCss }} />
      <svg
        ref={svgRef}
        className="te-curve__graph"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (dragRef.current = null)}
        onPointerCancel={() => (dragRef.current = null)}
        onDoubleClick={onDoubleClick}
        {...hint}
      >
        {[25, 50, 75].map((v) => (
          <g key={v} className="te-curve__grid">
            <line x1={v} y1={0} x2={v} y2={100} />
            <line x1={0} y1={v} x2={100} y2={v} />
          </g>
        ))}
        {bars.map((b, i) => (
          <rect key={i} className="te-curve__hist" x={b.x} y={100 - b.h} width={b.w} height={b.h} />
        ))}
        <line className="te-curve__diag" x1={0} y1={100} x2={100} y2={0} />
        <path className="te-curve__line" d={curvePath(curve)} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="te-curve__points" aria-hidden>
        {curve.points.map((p, i) => (
          <span key={i} className="te-curve__pt" style={{ left: `${p.x * 100}%`, top: `${(1 - p.y) * 100}%` }} />
        ))}
      </div>
      <div className="te-curve__xaxis" style={{ background: rampCss.replace('to top', 'to right') }} />
    </div>
  );
}
