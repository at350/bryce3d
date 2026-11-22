/** Paints the splash card: a sunset sky, fractal mountain ranges, a mirror sea and a chrome ball (original homage art). */
import { mulberry32 } from '@/core/math';

/** 1D midpoint-displacement ridge line, values 0..1 across `n + 1` points. */
export function ridgeLine(n: number, seed: number, roughness = 0.55): number[] {
  const size = 1 << Math.ceil(Math.log2(Math.max(2, n)));
  const pts = new Array<number>(size + 1).fill(0);
  const rnd = mulberry32(seed);
  pts[0] = rnd();
  pts[size] = rnd();
  let step = size;
  let amp = 0.6;
  while (step > 1) {
    const half = step / 2;
    for (let i = half; i < size; i += step) pts[i] = (pts[i - half] + pts[i + half]) / 2 + (rnd() - 0.5) * amp;
    amp *= roughness;
    step = half;
  }
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  return pts.slice(0, n + 1).map((v) => (v - lo) / (hi - lo || 1));
}

export function paintSplash(canvas: HTMLCanvasElement): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (!w || !h) return;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const horizon = h * 0.64;

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#120f3a');
  sky.addColorStop(0.42, '#4a2a7a');
  sky.addColorStop(0.75, '#c2508a');
  sky.addColorStop(1, '#ffb06a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  // stars in the deep part of the sky
  const rnd = mulberry32(1994);
  for (let i = 0; i < 90; i++) {
    const y = rnd() * horizon * 0.45;
    ctx.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.6})`;
    ctx.fillRect(rnd() * w, y, dpr * (rnd() > 0.9 ? 1.6 : 1), dpr * (rnd() > 0.9 ? 1.6 : 1));
  }

  // sun glow on the horizon
  const sx = w * 0.68;
  const glow = ctx.createRadialGradient(sx, horizon, 0, sx, horizon, h * 0.55);
  glow.addColorStop(0, 'rgba(255,236,190,0.95)');
  glow.addColorStop(0.12, 'rgba(255,190,120,0.55)');
  glow.addColorStop(1, 'rgba(255,120,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, horizon);

  // three mountain ranges, hazier with distance
  const ranges: { seed: number; base: number; height: number; color: string }[] = [
    { seed: 7, base: horizon, height: h * 0.3, color: 'rgba(120,70,130,0.55)' },
    { seed: 42, base: horizon, height: h * 0.24, color: 'rgba(62,36,84,0.85)' },
    { seed: 1984, base: horizon, height: h * 0.17, color: '#1b1430' },
  ];
  const shapes: number[][] = [];
  for (const r of ranges) {
    const line = ridgeLine(128, r.seed);
    shapes.push(line);
    ctx.beginPath();
    ctx.moveTo(0, r.base);
    line.forEach((v, i) => {
      const taper = Math.sin((i / 128) * Math.PI) * 0.6 + 0.4;
      ctx.lineTo((i / 128) * w, r.base - v * r.height * taper);
    });
    ctx.lineTo(w, r.base);
    ctx.closePath();
    ctx.fillStyle = r.color;
    ctx.fill();
  }

  // mirror sea
  const sea = ctx.createLinearGradient(0, horizon, 0, h);
  sea.addColorStop(0, '#5a3d78');
  sea.addColorStop(0.35, '#1d2a52');
  sea.addColorStop(1, '#070a1a');
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, w, h - horizon);
  // reflected nearest range
  const near = shapes[2];
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  near.forEach((v, i) => {
    const taper = Math.sin((i / 128) * Math.PI) * 0.6 + 0.4;
    ctx.lineTo((i / 128) * w, horizon + v * ranges[2].height * taper * 0.8);
  });
  ctx.lineTo(w, horizon);
  ctx.closePath();
  ctx.fillStyle = '#0d0a1c';
  ctx.fill();
  ctx.restore();
  // sun streaks on the water
  for (let i = 0; i < 26; i++) {
    const y = horizon + (i / 26) ** 1.6 * (h - horizon);
    const len = (0.04 + rnd() * 0.08) * w * (1 - i / 40);
    ctx.fillStyle = `rgba(255,205,150,${0.55 * (1 - i / 26)})`;
    ctx.fillRect(sx - len / 2 + (rnd() - 0.5) * w * 0.03, y, len, Math.max(1, dpr * (1 + i * 0.08)));
  }

  // chrome ball floating above its reflection
  const bx = w * 0.22;
  const by = horizon + h * 0.12;
  const br = h * 0.085;
  const ball = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.45, br * 0.05, bx, by, br);
  ball.addColorStop(0, '#ffffff');
  ball.addColorStop(0.25, '#f6c6d8');
  ball.addColorStop(0.55, '#6a4a8e');
  ball.addColorStop(0.8, '#1a1838');
  ball.addColorStop(1, '#f0a070');
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, Math.PI * 2);
  ctx.fillStyle = ball;
  ctx.fill();
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(bx, by + br * 1.35, br * 0.9, br * 0.25, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#c896d8';
  ctx.fill();
  ctx.globalAlpha = 1;
}
