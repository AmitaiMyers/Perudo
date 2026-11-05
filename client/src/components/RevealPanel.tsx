import { countMatchingDice, type PublicPlayer, type RevealSummary } from '@perudo/shared';
import { describeActionTags, playerName } from '../players';
import { BidText } from './BidText';
import { Die } from './Die';

interface RevealPanelProps {
  reveal: RevealSummary;
  players: PublicPlayer[];
}

export function RevealPanel({ reveal, players }: RevealPanelProps) {
  const name = (playerId: string) => playerName(players, playerId);

  return (
    <section className="reveal" aria-label="Revealed dice">
      <p className="reveal__headline">
        <strong>{name(reveal.liarCallerId)}</strong> called <strong>Liar</strong>
        {describeActionTags(reveal.interruption, reveal.forcedByTimeout)} on {name(reveal.bidderId)}&rsquo;s{' '}
        <BidText bid={reveal.bid} dieSize={22} />
      </p>
      {reveal.katzelCallerId !== null && (
        <p className="reveal__line">
          {name(reveal.katzelCallerId)} had called <strong>Katzel</strong>, so the count had to be exact.
        </p>
      )}
      <p className="reveal__line">
        There {reveal.actualCount === 1 ? 'was' : 'were'} <strong>{reveal.actualCount}</strong>. The Liar call was{' '}
        <strong>{reveal.liarWasCorrect ? 'right' : 'wrong'}</strong>.
      </p>
      <p className="reveal__result">
        <strong>{name(reveal.loserId)}</strong> loses a die.
        {reveal.bonusPlayerId !== null && (
          <>
            {' '}
            <strong>{name(reveal.bonusPlayerId)}</strong> earns the jump-in bonus (+1 die, max 5).
          </>
        )}
      </p>

      <ul className="reveal__hands">
        {players.map((player) => {
          const hand = reveal.dice[player.id];
          if (hand === undefined) throw new Error(`Reveal is missing dice for ${player.id}`);
          if (hand.length === 0) return null; // eliminated before this round
          return (
            <li key={player.id} className="reveal__hand">
              <span className="reveal__hand-name">{player.name}</span>
              <span className="reveal__hand-dice">
                {hand.map((face, index) => {
                  const counts = countMatchingDice([face], reveal.bid.face) === 1;
                  return <Die key={index} face={face} size={30} highlighted={counts} dimmed={!counts} />;
                })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
