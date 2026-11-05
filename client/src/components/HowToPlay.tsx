import { useRef, type ReactNode } from 'react';
import { Die } from './Die';
import { Icon } from './Icon';

/** "How to play" button (icon or text) that opens the rules sheet. */
export function HowToPlay({ variant }: { variant: 'icon' | 'text' }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const dialog = () => {
    const element = dialogRef.current;
    if (element === null) throw new Error('Rules dialog is not mounted.');
    return element;
  };

  return (
    <>
      {variant === 'icon' ? (
        <button type="button" className="icon-button" onClick={() => dialog().showModal()} aria-label="How to play">
          <Icon name="help" />
        </button>
      ) : (
        <button type="button" className="link-button" onClick={() => dialog().showModal()}>
          How to play
        </button>
      )}
      <dialog
        ref={dialogRef}
        className="sheet"
        aria-label="How to play"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog().close(); // tap on the backdrop
        }}
      >
        <div className="sheet__content">
          <header className="sheet__header">
            <h2>How to play</h2>
            <button type="button" className="icon-button" onClick={() => dialog().close()} aria-label="Close">
              ✕
            </button>
          </header>

          <Rule title="🎯 Goal">Be the last player with dice. Everyone starts with 5, hidden under a cup.</Rule>
          <Rule title="Pacos are wild" icon={<Die face={1} size={30} />}>
            The bird counts as <em>any</em> face being bid. A bid on Pacos counts only Pacos.
          </Rule>
          <Rule title="🗣️ Bidding">
            Guess how many dice of one face are on the <em>whole table</em> (&ldquo;four 3s&rdquo;). Each bid must be
            higher: more dice, or the same number of a higher face. No Pacos on the opening bid.
          </Rule>
          <Rule title="🔄 Switching to or from Pacos">
            To Pacos: at least half (rounded up), so six 4s → three Pacos. Back from Pacos: double plus one, so three
            Pacos → seven of any face.
          </Rule>
          <Rule title="⏱️ 30 seconds">
            Act before your timer runs out, or the game calls Liar for you (or makes the smallest opening bid if nobody
            has bid yet).
          </Rule>
          <Rule title="⚡ Jump in">
            You can act even when it is not your turn. Play then continues from the player after you.
          </Rule>
          <Rule title="🤞 Katzel">
            Bet the count is <em>exactly</em> the bid. Play continues; if someone then calls Liar, the dice must match
            exactly. Not exact: the Katzel caller loses a die. Exact: the Liar caller loses one.
          </Rule>
          <Rule title="🤥 Liar!">
            Think the bid is too high? Call Liar. All cups lift. Fewer dice than bid: the bidder loses a die. Otherwise
            the caller loses one. Jumped in and were right? You win a die back (max 5).
          </Rule>
          <Rule title="🎯 Last die">
            Whenever a player drops to their last die, the next round is special: they open it (nobody can jump in
            first), the opening bid may be on any face (Pacos too), and every bid that round must stay on that face.
            Pacos stay wild.
          </Rule>
          <Rule title="🔁 Next round">Whoever lost a die starts. No dice left: you are out.</Rule>

          <button type="button" className="button button--primary" onClick={() => dialog().close()}>
            Got it!
          </button>
        </div>
      </dialog>
    </>
  );
}

function Rule({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="rule">
      <h3 className="rule__title">
        {icon}
        {title}
      </h3>
      <p className="rule__text">{children}</p>
    </section>
  );
}
