import type { PublicPlayer } from '@perudo/shared';
import { HiddenDie } from './Die';

interface PlayerSeatProps {
  player: PublicPlayer;
  isMe: boolean;
  isTurn: boolean;
  isBidder: boolean;
  isKatzelCaller: boolean;
}

export function PlayerSeat({ player, isMe, isTurn, isBidder, isKatzelCaller }: PlayerSeatProps) {
  const classes = ['seat', isTurn ? 'seat--turn' : '', player.eliminated ? 'seat--out' : '', isMe ? 'seat--me' : ''];
  return (
    <li className={classes.join(' ')}>
      <div className="seat__name">
        {player.name}
        {isMe && <span className="tag">you</span>}
        {player.isHost && <span className="tag">host</span>}
        {!player.connected && <span className="tag tag--warn">offline</span>}
      </div>
      <div className="seat__dice" aria-label={`${player.diceCount} dice`}>
        {player.eliminated ? (
          <span className="seat__out">out</span>
        ) : (
          Array.from({ length: player.diceCount }, (_, index) => <HiddenDie key={index} />)
        )}
      </div>
      <div className="seat__badges">
        {isTurn && <span className="tag tag--turn">turn</span>}
        {isBidder && <span className="tag tag--bid">bid</span>}
        {isKatzelCaller && <span className="tag tag--katzel">katzel</span>}
      </div>
    </li>
  );
}
