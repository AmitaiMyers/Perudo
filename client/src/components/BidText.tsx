import type { Bid } from '@perudo/shared';
import { Die } from './Die';

export function BidText({ bid, dieSize = 28 }: { bid: Bid; dieSize?: number }) {
  return (
    <span className="bid-text">
      <span className="bid-text__quantity">{bid.quantity}</span>
      <span className="bid-text__times">×</span>
      <Die face={bid.face} size={dieSize} />
    </span>
  );
}
