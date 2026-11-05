import { randomInt } from 'node:crypto';
import { ROOM_CODE_LENGTH } from '@perudo/shared';
import { Room, type RoomHooks } from './room';

/** Letters only, without look-alikes (I, O) so codes are easy to read aloud. */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();

  constructor(private readonly emitState: RoomHooks['emitState']) {}

  create(): Room {
    const code = this.generateUniqueCode();
    const room = new Room(code, {
      emitState: this.emitState,
      onClosed: (closedCode) => this.rooms.delete(closedCode),
    });
    this.rooms.set(code, room);
    return room;
  }

  find(code: string): Room | null {
    return this.rooms.get(code.trim().toUpperCase()) ?? null;
  }

  remove(code: string): void {
    this.rooms.delete(code);
  }

  private generateUniqueCode(): string {
    let code: string;
    do {
      code = Array.from(
        { length: ROOM_CODE_LENGTH },
        () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)],
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }
}
