import { useStore } from '../../state/store';
import { RefreshIcon, ThunderIcon } from '../icons';
import { statusMessage } from './lightningHelpers';
import { useNow } from './useNow';

const BUTTON =
  'z-[1000] flex h-11 items-center justify-center rounded-full map-control backdrop-blur-xl disabled:opacity-60';

/** Lightning's refresh button (while on) and on/off switch, unpositioned. */
export function LightningButtons() {
  const { lightning } = useStore();
  const isLoading = lightning.status === 'loading';

  return (
    <>
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
        className={`${BUTTON} gap-1.5 px-3 text-sm`}
      >
        <ThunderIcon className="h-4 w-4" />
        <span aria-hidden="true">{lightning.enabled ? 'On' : 'Off'}</span>
      </button>
    </>
  );
}

/** Lightning's status line (unpositioned): the "Show latest lightning" prompt, count and time. */
export function LightningStatusStrip() {
  const { lightning } = useStore();
  const now = useNow(30_000, lightning.observation);
  const message = statusMessage(lightning.status, lightning.observation, now);

  return (
    <div role="status" className="rounded-xl map-control px-3 py-1.5 text-xs backdrop-blur-xl">
      {lightning.status === 'idle' ? (
        // Negative margins grow the tap area (44px on touch, 24px with a mouse) without growing the strip.
        <button
          type="button"
          onClick={() => void lightning.refresh('prompt')}
          className="-my-3 inline-flex min-h-11 items-center underline md:pointer-fine:-my-1 md:pointer-fine:min-h-6"
        >
          {message.text}
        </button>
      ) : (
        <span>{message.text}</span>
      )}
      {message.updatedText && <span className="ml-2">{message.updatedText}</span>}
    </div>
  );
}
