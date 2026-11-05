import { useEffect, useRef } from 'react';
import { isPaco, type PublicPlayer, type RevealSummary as RevealData } from '@perudo/shared';
import { bonusDieGainer, describeActionTags, playerName } from '../players';
import type { RevealStage } from '../useRevealStage';
import { Avatar } from './Avatar';
import { BidText } from './BidText';

/** Middle of the table during a reveal: what is being counted, the running count and the target. */
export function RevealCounter({ reveal, stage }: { reveal: RevealData; stage: RevealStage }) {
  const exact = reveal.katzelCallerId !== null;
  return (
    <div className="center-count" aria-live="polite">
      <span className="center-count__label">
        counting {isPaco(reveal.bid.face) ? 'Pacos' : `${reveal.bid.face}s + Pacos`}
      </span>
      <span key={stage.countSoFar} className="center-count__value">
        {stage.countSoFar}
      </span>
      <span className="center-count__label">
        {exact ? 'needs exactly' : 'bid'} <BidText bid={reveal.bid} dieSize={16} />
      </span>
      {stage.verdictShown && (
        <span className={`center-count__verdict ${reveal.liarWasCorrect ? 'is-right' : 'is-wrong'}`}>
          {reveal.liarWasCorrect ? '✔' : '✘'}
        </span>
      )}
    </div>
  );
}

interface RevealSummaryProps {
  reveal: RevealData;
  players: PublicPlayer[];
  stage: RevealStage;
}

/** Below the table: who called Liar on what, then the verdict once the cups are up. */
export function RevealSummary({ reveal, players, stage }: RevealSummaryProps) {
  const name = (playerId: string) => playerName(players, playerId);
  return (
    <section className="summary" aria-label="Round result">
      <p className="summary__call">
        <Avatar players={players} playerId={reveal.liarCallerId} size={26} />
        <span>
          <strong>{name(reveal.liarCallerId)}</strong> called <strong className="summary__liar">LIAR!</strong>
          <span className="summary__tags">
            {describeActionTags(reveal.interruption, reveal.forcedByTimeout)}
          </span> on {name(reveal.bidderId)}&rsquo;s <BidText bid={reveal.bid} dieSize={18} />
        </span>
      </p>
      {reveal.katzelCallerId !== null && (
        <p className="summary__katzel">
          🤞 {name(reveal.katzelCallerId)} called Katzel: it must be <strong>exactly {reveal.bid.quantity}</strong>
        </p>
      )}
      {stage.verdictShown ? (
        <Verdict reveal={reveal} players={players} />
      ) : (
        <p className="summary__waiting">Lifting the cups…</p>
      )}
    </section>
  );
}

function Verdict({ reveal, players }: { reveal: RevealData; players: PublicPlayer[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const name = (playerId: string) => playerName(players, playerId);

  // The summary area can scroll on small phones; make sure the punchline is visible.
  useEffect(() => {
    const element = ref.current;
    if (element === null) throw new Error('Verdict is not mounted.');
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  return (
    <div ref={ref} className={`verdict ${reveal.liarWasCorrect ? 'verdict--right' : 'verdict--wrong'}`} role="status">
      <p className="verdict__title">{reveal.liarWasCorrect ? '✔ Liar was right!' : '✘ Liar was wrong!'}</p>
      <p className="verdict__line">
        <Avatar players={players} playerId={reveal.loserId} size={22} /> <strong>{name(reveal.loserId)}</strong> loses a
        die
        {reveal.bonusPlayerId !== null && (
          <>
            {' · '}
            <Avatar players={players} playerId={reveal.bonusPlayerId} size={22} />{' '}
            <strong>{name(reveal.bonusPlayerId)}</strong>{' '}
            {bonusDieGainer(reveal, players) === null ? 'jumped in right (already at 5 dice)' : 'wins one back ⚡'}
          </>
        )}
      </p>
    </div>
  );
}
