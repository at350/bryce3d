/** Parameter descriptions shared by generators and ops (they also drive the editor's sliders). */

export type Params = Record<string, number>;

export interface ParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  default: number;
  /** 1 for integer parameters. */
  step?: number;
  /** Decimal places shown in the UI. */
  precision?: number;
  hint?: string;
}

/** Fill defaults and clamp to each spec's range. Unknown keys are ignored. */
export function resolveParams(specs: readonly ParamSpec[], given: Params | undefined): Params {
  const out: Params = {};
  for (const s of specs) {
    const v = given?.[s.key];
    let value = typeof v === 'number' && Number.isFinite(v) ? Math.min(s.max, Math.max(s.min, v)) : s.default;
    if (s.step === 1) value = Math.round(value);
    out[s.key] = value;
  }
  return out;
}

/** Default values of a spec list. */
export function defaultParams(specs: readonly ParamSpec[]): Params {
  return resolveParams(specs, undefined);
}

/** The amount (0..1) an op is blended in with: Bryce's "apply gradually". */
export function blendAmount(params: Params | undefined): number {
  const a = params?.amount;
  return typeof a === 'number' && Number.isFinite(a) ? Math.min(1, Math.max(0, a)) : 1;
}
