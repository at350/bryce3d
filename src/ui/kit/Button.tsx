/** Text buttons and icon buttons. */
import type { CSSProperties, ReactNode } from 'react';
import { useHint } from './hint';

export interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  hint?: string;
  variant?: 'default' | 'primary' | 'ghost';
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Visual pressed state for toggle-like buttons. */
  pressed?: boolean;
  type?: 'button' | 'submit';
  title?: string;
}

/** Beveled metal pill button (primary = glossy accent). */
export function Button({ children, onClick, hint, variant = 'default', disabled, className = '', style, pressed, type = 'button', title }: ButtonProps) {
  return (
    <button
      type={type}
      className={`bk-button bk-button--${variant} ${pressed ? 'is-pressed' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
      aria-pressed={pressed}
      title={title}
      {...useHint(hint)}
    >
      {children}
    </button>
  );
}

export interface IconButtonProps {
  /** Shown in the Text Display Area on hover (also the accessible label). */
  hint: string;
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  active?: boolean;
  disabled?: boolean;
  /** Square size in px (default 36). */
  size?: number;
  className?: string;
  style?: CSSProperties;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /** Exposes `active` as aria-pressed (toggle buttons). */
  toggle?: boolean;
  /** Overrides the accessible label (defaults to hint). */
  ariaLabel?: string;
}

/** Borderless button around a 3D icon: glows on hover, sits in a lit socket when active. */
export function IconButton({
  hint,
  children,
  onClick,
  onPointerDown,
  active,
  disabled,
  size = 36,
  className = '',
  style,
  onDoubleClick,
  onKeyDown,
  toggle,
  ariaLabel,
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? hint}
      aria-pressed={toggle ? !!active : undefined}
      className={`bk-iconbutton ${active ? 'is-active' : ''} ${className}`}
      style={{ width: size, height: size, ...style }}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      disabled={disabled}
      {...useHint(hint)}
    >
      {children}
    </button>
  );
}
