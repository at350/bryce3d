/**
 * A Terrain Editor tool button, Bryce style: click applies the effect at 100%; click and drag
 * to the right applies it gradually (the fill bar shows how much).
 */
import { useRef, useState, type ReactNode } from 'react';
import { useHint } from '@/ui/kit';
import { capturePointer } from './capture';

interface Props {
  label: string;
  hint: string;
  onApply(): void;
  /** Gradual application; omit to make the button click-only. */
  gradual?: {
    start(): void;
    change(amount: number): void;
    end(amount: number): void;
  };
  icon?: ReactNode;
  disabled?: boolean;
  active?: boolean;
  variant?: 'tile' | 'pill';
  className?: string;
}

const DRAG_PX = 150;

export function ToolButton({ label, hint, onApply, gradual, icon, disabled, active, variant = 'pill', className = '' }: Props) {
  const [amount, setAmount] = useState<number | null>(null);
  // The controller is captured at pointer-down: props may change while dragging.
  const drag = useRef<{ x: number; on: boolean; amount: number; ctrl: NonNullable<Props['gradual']> } | null>(null);
  const suppressClick = useRef(false);
  const fullHint = gradual ? `${label}: ${hint} (click, or drag right to apply gradually)` : `${label}: ${hint}`;

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0 || !gradual) return;
    drag.current = { x: e.clientX, on: false, amount: 0, ctrl: gradual };
    capturePointer(e.currentTarget, e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.on && Math.abs(dx) > 5) {
      d.on = true;
      d.ctrl.start();
    }
    if (!d.on) return;
    const a = Math.min(1, Math.max(0, dx / DRAG_PX));
    if (a !== d.amount) {
      d.amount = a;
      setAmount(a);
      d.ctrl.change(a);
    }
  };
  const finish = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.on) return;
    suppressClick.current = true;
    setAmount(null);
    d.ctrl.end(d.amount);
  };

  return (
    <button
      type="button"
      className={`te-tool te-tool--${variant} ${active ? 'is-active' : ''} ${amount !== null ? 'is-dragging' : ''} ${className}`}
      disabled={disabled}
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onApply();
      }}
      {...useHint(fullHint)}
    >
      {icon && <span className="te-tool__icon">{icon}</span>}
      <span className="te-tool__label">{label}</span>
      {amount !== null && (
        <span className="te-tool__amount" aria-hidden>
          <span style={{ width: `${amount * 100}%` }} />
          <em>{Math.round(amount * 100)}%</em>
        </span>
      )}
    </button>
  );
}
