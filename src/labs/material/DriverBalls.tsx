/**
 * Bryce component indicators: three little balls (A, B, C) per channel row. Clicking a
 * ball drives the channel with that texture component; clicking the lit ball again
 * returns the channel to its fixed value.
 */
import { useHint } from '@/ui/kit';
import { COMPONENT_LETTERS } from '@/materials/channels';

export interface DriverBallsProps {
  channelLabel: string;
  /** Driving component index, or -1 for the fixed value. */
  active: number;
  /** null: the channel only takes a fixed value. */
  enabled: boolean;
  componentCount: number;
  onPick: (index: 0 | 1 | 2) => void;
}

export function DriverBalls({ channelLabel, active, enabled, componentCount, onPick }: DriverBallsProps) {
  return (
    <div className="ml-balls" role="radiogroup" aria-label={`${channelLabel} texture component`}>
      {COMPONENT_LETTERS.map((letter, i) => (
        <Ball
          key={letter}
          letter={letter}
          on={active === i}
          enabled={enabled}
          exists={i < componentCount}
          channelLabel={channelLabel}
          onClick={() => onPick(i as 0 | 1 | 2)}
        />
      ))}
    </div>
  );
}

function Ball({ letter, on, enabled, exists, channelLabel, onClick }: { letter: string; on: boolean; enabled: boolean; exists: boolean; channelLabel: string; onClick: () => void }) {
  const hint = !enabled
    ? `${channelLabel} takes a fixed value only`
    : on
      ? `${channelLabel} is driven by component ${letter}: click to return to a fixed value`
      : exists
        ? `Drive ${channelLabel} with component ${letter}`
        : `Create component ${letter} and let it drive ${channelLabel}`;
  const hintHandlers = useHint(hint);
  if (!enabled) return <span className="ml-ball is-disabled" aria-hidden="true" {...hintHandlers} />;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={hint}
      className={`ml-ball ${on ? 'is-on' : ''} ${exists ? '' : 'is-empty'}`}
      onClick={onClick}
      {...hintHandlers}
    />
  );
}
