import { useState } from 'react';
import { isMuted, setMuted } from '../sound';
import { Icon } from './Icon';

export function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted);
  const toggle = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };
  return (
    <button
      type="button"
      className="icon-button"
      onClick={toggle}
      aria-label={muted ? 'Turn sound on' : 'Mute sound'}
      aria-pressed={muted}
    >
      <Icon name={muted ? 'soundOff' : 'soundOn'} />
    </button>
  );
}
