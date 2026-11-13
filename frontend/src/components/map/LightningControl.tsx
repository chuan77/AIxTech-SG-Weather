import { useStore } from '../../state/store';
import { RefreshIcon, ThunderIcon } from '../icons';
import { statusMessage } from './lightningHelpers';
import { useNow } from './useNow';

const BUTTON =
  'z-[1000] flex h-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-[#fff] backdrop-blur-xl hover:bg-black/55 disabled:opacity-60';

interface LightningControlProps {
  /** Positions the switch and refresh buttons inside the map container. */
  className: string;
}

/** On/off switch, refresh button and status strip for the lightning layer. */
export function LightningControl({ className }: LightningControlProps) {
  const { lightning } = useStore();
  const now = useNow(30_000, lightning.observation);
  const isLoading = lightning.status === 'loading';
  const message = statusMessage(lightning.status, lightning.observation, now);

  return (
    <>
      <div className={`absolute z-[1000] flex items-center gap-2 ${className}`}>
        {lightning.enabled && (
          <button
            type="button"
            onClick={() => void lightning.refresh()}
            disabled={isLoading}
            aria-busy={isLoading}
            aria-label="Refresh lightning"
            className={`${BUTTON} w-11`}
          >
            <RefreshIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={lightning.enabled}
          aria-label="Lightning"
          onClick={() => lightning.setEnabled(!lightning.enabled)}
          className={`${BUTTON} gap-1.5 px-3 text-sm ${lightning.enabled ? '' : 'opacity-75'}`}
        >
          <ThunderIcon className="h-4 w-4" />
          <span aria-hidden="true">{lightning.enabled ? 'On' : 'Off'}</span>
        </button>
      </div>
      {lightning.enabled && (
        <div
          role="status"
          className="absolute bottom-2 left-2 z-[1000] max-w-[70%] rounded-xl border border-white/20 bg-black/50 px-3 py-1.5 text-xs text-[#fff] backdrop-blur-xl"
        >
          {lightning.status === 'idle' ? (
            <button type="button" onClick={() => void lightning.refresh()} className="underline">
              {message.text}
            </button>
          ) : (
            <span>{message.text}</span>
          )}
          {message.updatedText && <span className="ml-2 opacity-70">{message.updatedText}</span>}
        </div>
      )}
    </>
  );
}
