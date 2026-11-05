import { useState } from 'react';
import { REACTION_COOLDOWN_MS, REACTION_EMOJIS } from '@perudo/shared';

/**
 * A single smiley button in the top bar that opens a tray of emoji.
 * Sending closes the tray; a short cooldown mirrors the server's spam guard.
 */
export function ReactionPicker({ onReact }: { onReact: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);

  const react = (emoji: string) => {
    onReact(emoji);
    setOpen(false);
    setCoolingDown(true);
    window.setTimeout(() => setCoolingDown(false), REACTION_COOLDOWN_MS);
  };

  return (
    <span className="reaction-picker">
      <button
        type="button"
        className="icon-button"
        onClick={() => setOpen(!open)}
        disabled={coolingDown}
        aria-expanded={open}
        aria-label="Send a reaction"
      >
        😀
      </button>
      {open && (
        <span className="reaction-picker__tray" role="group" aria-label="Reactions">
          {REACTION_EMOJIS.map((emoji) => (
            <button key={emoji} type="button" className="reaction-picker__emoji" onClick={() => react(emoji)}>
              {emoji}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
