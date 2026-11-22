/**
 * Keeps one module's crash from taking down the whole app: the failing region shows a small
 * "try again" card while every other palette keeps working. `resetKey` changes (e.g. the
 * active palette) clear the error automatically.
 */
import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Shown in the fallback ("The Sky & Fog palette hit a snag"). */
  name: string;
  children: ReactNode;
  resetKey?: unknown;
  /** Extra action for full-screen regions (e.g. close the lab). */
  onClose?: () => void;
  closeLabel?: string;
  variant?: 'inline' | 'overlay';
  /** Placement of the fallback (e.g. its grid area). */
  style?: CSSProperties;
}

interface State {
  error: Error | null;
  key: unknown;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { key: props.resetKey, error: null } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.name}]`, error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { name, onClose, closeLabel = 'Close', variant = 'inline', style } = this.props;
    return (
      <div className={`crash crash--${variant}`} role="alert" style={style}>
        <div className="crash__card">
          <strong>{name} hit a snag.</strong>
          <span className="crash__detail">{error.message || 'Unexpected error'}</span>
          <span className="crash__actions">
            <button type="button" className="bk-button" onClick={this.reset}>
              Try again
            </button>
            {onClose && (
              <button
                type="button"
                className="bk-button"
                onClick={() => {
                  this.reset();
                  onClose();
                }}
              >
                {closeLabel}
              </button>
            )}
          </span>
        </div>
      </div>
    );
  }
}
