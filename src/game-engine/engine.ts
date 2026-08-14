import {
  PlayerColor,
  PlayerSlot,
  TokenZone,
  TokenState,
  GameDocument,
  RoomSettings,
} from '../types';

// Canonical shared track length
export const TRACK_LENGTH = 52;
export const HOME_PATH_START_PROGRESS = 51;
export const FINAL_HOME_PROGRESS = 56;

// Starting global track indices for each player slot
export const SLOT_START_TRACK_INDEX: Record<PlayerSlot, number> = {
  P1: 0,  // Red (bottom-left / left)
  P2: 13, // Green (top-left / top)
  P3: 26, // Yellow (top-right / right)
  P4: 39, // Blue (bottom-right / bottom)
};

// Safe squares on the 52-cell track:
// 4 starting squares + 4 star squares (8 spaces ahead of each start)
export const SAFE_TRACK_INDICES = new Set<number>([
  0,  // P1 Start
  8,  // Star 1
  13, // P2 Start
  21, // Star 2
  26, // P3 Start
  34, // Star 3
  39, // P4 Start
  47, // Star 4
]);

export function isSafeTrackIndex(trackIndex: number): boolean {
  return SAFE_TRACK_INDICES.has(trackIndex % TRACK_LENGTH);
}

export function getPlayerStartIndex(slot: PlayerSlot): number {
  return SLOT_START_TRACK_INDEX[slot] ?? 0;
}

export function getGlobalTrackIndex(slot: PlayerSlot, progress: number): number | null {
  if (progress < 0 || progress >= HOME_PATH_START_PROGRESS) {
    return null; // Not on shared track
  }
  const startIdx = getPlayerStartIndex(slot);
  return (startIdx + progress) % TRACK_LENGTH;
}

export interface MoveCalculation {
  canMove: boolean;
  reason?: string;
  newZone: TokenZone;
  newProgress: number;
  capturedTokens: {
    uid: string;
    tokenId: number;
    slot: PlayerSlot;
  }[];
  isHome: boolean;
  grantsExtraTurn: boolean;
}

export function areTeammates(slotA: PlayerSlot, slotB: PlayerSlot): boolean {
  if (slotA === slotB) return true;
  const isTeam1A = slotA === 'P1' || slotA === 'P3';
  const isTeam1B = slotB === 'P1' || slotB === 'P3';
  return isTeam1A === isTeam1B;
}

/**
 * Checks whether a token can legally move given a dice roll
 */
export function calculateTokenMove(
  token: { id: number; zone: TokenZone; progress: number },
  slot: PlayerSlot,
  uid: string,
  diceValue: number,
  allTokens: GameDocument['tokens'],
  slotMap: Record<string, PlayerSlot>,
  settings: RoomSettings
): MoveCalculation {
  // 1. Token already finished
  if (token.zone === 'HOME' || token.progress === FINAL_HOME_PROGRESS) {
    return {
      canMove: false,
      reason: 'Token already reached Home',
      newZone: 'HOME',
      newProgress: FINAL_HOME_PROGRESS,
      capturedTokens: [],
      isHome: true,
      grantsExtraTurn: false,
    };
  }

  // 2. Token in Yard
  if (token.zone === 'YARD' || token.progress === -1) {
    if (diceValue !== 6) {
      return {
        canMove: false,
        reason: 'Requires a 6 to leave Yard',
        newZone: 'YARD',
        newProgress: -1,
        capturedTokens: [],
        isHome: false,
        grantsExtraTurn: false,
      };
    }

    // Rolling a 6 allows entering start square (progress = 0)
    const startGlobalIdx = getPlayerStartIndex(slot);
    const captured: MoveCalculation['capturedTokens'] = [];

    // Check if landing square has opponents (cannot capture on safe start, but let's check)
    // Note: Start squares are safe positions, so no capture happens on starting square.
    return {
      canMove: true,
      newZone: 'TRACK',
      newProgress: 0,
      capturedTokens: captured,
      isHome: false,
      grantsExtraTurn: true, // Rolling 6 gives extra turn
    };
  }

  // 3. Token is on Track or Home Path
  const targetProgress = token.progress + diceValue;

  // Exact home rule: overshooting is invalid
  if (targetProgress > FINAL_HOME_PROGRESS) {
    return {
      canMove: false,
      reason: 'Overshoots Home - exact roll required',
      newZone: token.zone,
      newProgress: token.progress,
      capturedTokens: [],
      isHome: false,
      grantsExtraTurn: false,
    };
  }

  // Determine new zone
  let targetZone: TokenZone = 'TRACK';
  if (targetProgress === FINAL_HOME_PROGRESS) {
    targetZone = 'HOME';
  } else if (targetProgress >= HOME_PATH_START_PROGRESS) {
    targetZone = 'HOME_PATH';
  }

  // Check blockade rule along the path if enabled
  if (settings.allowBlockades && targetZone === 'TRACK') {
    // Check if opponent has 2+ tokens on destination
    const targetGlobalIdx = getGlobalTrackIndex(slot, targetProgress);
    if (targetGlobalIdx !== null) {
      for (const [otherUid, playerTokens] of Object.entries(allTokens)) {
        if (otherUid === uid) continue;
        const otherSlot = slotMap[otherUid];
        if (!otherSlot) continue;

        // In TEAM mode, teammates do not blockade each other
        if (settings.gameMode === 'TEAM' && areTeammates(slot, otherSlot)) {
          continue;
        }

        let tokensOnCell = 0;
        for (const t of Object.values(playerTokens)) {
          if (t.zone === 'TRACK' && getGlobalTrackIndex(otherSlot, t.progress) === targetGlobalIdx) {
            tokensOnCell++;
          }
        }
        if (tokensOnCell >= 2 && !isSafeTrackIndex(targetGlobalIdx)) {
          return {
            canMove: false,
            reason: 'Destination is blocked by opponent blockade',
            newZone: token.zone,
            newProgress: token.progress,
            capturedTokens: [],
            isHome: false,
            grantsExtraTurn: false,
          };
        }
      }
    }
  }

  // Check captures
  const captured: MoveCalculation['capturedTokens'] = [];
  let grantsExtraTurn = diceValue === 6;

  if (targetZone === 'TRACK') {
    const targetGlobalIdx = getGlobalTrackIndex(slot, targetProgress);
    if (targetGlobalIdx !== null && !isSafeTrackIndex(targetGlobalIdx)) {
      // Look for opponent tokens on this cell
      for (const [otherUid, playerTokens] of Object.entries(allTokens)) {
        if (otherUid === uid) continue;
        const otherSlot = slotMap[otherUid];
        if (!otherSlot) continue;

        // In TEAM mode, teammates cannot be captured
        if (settings.gameMode === 'TEAM' && areTeammates(slot, otherSlot)) {
          continue;
        }

        for (const t of Object.values(playerTokens)) {
          if (t.zone === 'TRACK' && getGlobalTrackIndex(otherSlot, t.progress) === targetGlobalIdx) {
            captured.push({
              uid: otherUid,
              tokenId: t.id,
              slot: otherSlot,
            });
          }
        }
      }
    }
  }

  // If captured opponent, grant an extra roll!
  if (captured.length > 0) {
    grantsExtraTurn = true;
  }

  // If reached home, grant an extra roll in traditional Bangladeshi rules
  if (targetZone === 'HOME') {
    grantsExtraTurn = true;
  }

  return {
    canMove: true,
    newZone: targetZone,
    newProgress: targetProgress,
    capturedTokens: captured,
    isHome: targetZone === 'HOME',
    grantsExtraTurn,
  };
}

/**
 * Returns a list of token IDs that are legally movable for the player
 */
export function getLegalMoves(
  uid: string,
  slot: PlayerSlot,
  diceValue: number,
  allTokens: GameDocument['tokens'],
  slotMap: Record<string, PlayerSlot>,
  settings: RoomSettings
): number[] {
  const playerTokens = allTokens[uid];
  if (!playerTokens) return [];

  const legalTokenIds: number[] = [];

  for (let tokenId = 0; tokenId < 4; tokenId++) {
    const token = playerTokens[tokenId.toString()] || playerTokens[tokenId];
    if (!token) continue;

    const move = calculateTokenMove(
      token,
      slot,
      uid,
      diceValue,
      allTokens,
      slotMap,
      settings
    );

    if (move.canMove) {
      legalTokenIds.push(token.id);
    }
  }

  return legalTokenIds;
}

/**
 * Check if a player has won (tokens in HOME >= tokensToWin, default 4)
 */
export function hasPlayerWon(
  uid: string,
  tokens: GameDocument['tokens'],
  tokensToWin: number = 4
): boolean {
  const playerTokens = tokens[uid];
  if (!playerTokens) return false;
  const homeCount = countTokensHome(uid, tokens);
  return homeCount >= Math.max(1, Math.min(4, tokensToWin));
}

/**
 * Count how many tokens have reached HOME for a player
 */
export function countTokensHome(uid: string, tokens: GameDocument['tokens']): number {
  const playerTokens = tokens[uid];
  if (!playerTokens) return 0;
  let count = 0;
  for (let i = 0; i < 4; i++) {
    const t = playerTokens[i.toString()] || playerTokens[i];
    if (t && (t.zone === 'HOME' || t.progress === FINAL_HOME_PROGRESS)) {
      count++;
    }
  }
  return count;
}

/**
 * Determines next player in turn order, skipping players who have already finished
 */
export function getNextPlayerUid(
  playerOrder: string[],
  currentPlayerUid: string,
  tokens: GameDocument['tokens'],
  tokensToWin: number = 4
): string {
  if (playerOrder.length === 0) return currentPlayerUid;
  const currentIdx = playerOrder.indexOf(currentPlayerUid);
  const total = playerOrder.length;

  for (let i = 1; i <= total; i++) {
    const nextIdx = (currentIdx + i) % total;
    const nextUid = playerOrder[nextIdx];
    if (!hasPlayerWon(nextUid, tokens, tokensToWin)) {
      return nextUid;
    }
  }
  return currentPlayerUid;
}

/**
 * Helper to compute projected landing destination and preview attributes for a token move
 */
export function getProjectedLandingInfo(
  token: { id: number; zone: TokenZone; progress: number },
  slot: PlayerSlot,
  uid: string,
  diceValue: number,
  allTokens: GameDocument['tokens'],
  slotMap: Record<string, PlayerSlot>,
  settings: RoomSettings
): {
  canMove: boolean;
  targetCoord: [number, number];
  isSafe: boolean;
  isCapture: boolean;
  isHome: boolean;
} | null {
  const move = calculateTokenMove(
    token,
    slot,
    uid,
    diceValue,
    allTokens,
    slotMap,
    settings
  );

  if (!move.canMove) return null;

  const targetCoord = getTokenGridCoordinates(
    slot,
    token.id,
    move.newZone,
    move.newProgress
  );

  let isSafe = false;
  if (move.newZone === 'TRACK') {
    const globalIdx = getGlobalTrackIndex(slot, move.newProgress);
    if (globalIdx !== null && isSafeTrackIndex(globalIdx)) {
      isSafe = true;
    }
  } else if (move.newZone === 'HOME_PATH' || move.newZone === 'HOME') {
    isSafe = true;
  }

  return {
    canMove: true,
    targetCoord,
    isSafe,
    isCapture: move.capturedTokens.length > 0,
    isHome: move.isHome,
  };
}

/**
 * Board Layout Coordinate Mapper for visual 15x15 Ludo Grid
 * Returns [row, col] on standard 15x15 Ludo board (0-indexed 0..14)
 */

// 52 Common Track Cells Coordinates [row, col] on 15x15 grid
// Clockwise starting from Red Start (row 6, col 1):
export const TRACK_GRID_COORDINATES: [number, number][] = [
  [6, 1],  // 0: P1 Start (Red) - SAFE
  [6, 2],  // 1
  [6, 3],  // 2
  [6, 4],  // 3
  [6, 5],  // 4
  [5, 6],  // 5 (Turns Up)
  [4, 6],  // 6
  [3, 6],  // 7
  [2, 6],  // 8: SAFE (Star 1)
  [1, 6],  // 9
  [0, 6],  // 10
  [0, 7],  // 11 (Top Middle)
  [0, 8],  // 12
  [1, 8],  // 13: P2 Start (Green) - SAFE
  [2, 8],  // 14
  [3, 8],  // 15
  [4, 8],  // 16
  [5, 8],  // 17
  [6, 9],  // 18 (Turns Right)
  [6, 10], // 19
  [6, 11], // 20
  [6, 12], // 21: SAFE (Star 2)
  [6, 13], // 22
  [6, 14], // 23
  [7, 14], // 24 (Right Middle)
  [8, 14], // 25
  [8, 13], // 26: P3 Start (Yellow) - SAFE
  [8, 12], // 27
  [8, 11], // 28
  [8, 10], // 29
  [8, 9],  // 30
  [9, 8],  // 31 (Turns Down)
  [10, 8], // 32
  [11, 8], // 33
  [12, 8], // 34: SAFE (Star 3)
  [13, 8], // 35
  [14, 8], // 36
  [14, 7], // 37 (Bottom Middle)
  [14, 6], // 38
  [13, 6], // 39: P4 Start (Blue) - SAFE
  [12, 6], // 40
  [11, 6], // 41
  [10, 6], // 42
  [9, 6],  // 43
  [8, 5],  // 44 (Turns Left)
  [8, 4],  // 45
  [8, 3],  // 46
  [8, 2],  // 47: SAFE (Star 4)
  [8, 1],  // 48
  [8, 0],  // 49
  [7, 0],  // 50 (Left Middle)
  [6, 0],  // 51
];

// Home Path 5 cells for each slot (progress 51..55)
export const HOME_PATHS_GRID_COORDINATES: Record<PlayerSlot, [number, number][]> = {
  P1: [ // Red (row 7, cols 1..5)
    [7, 1], [7, 2], [7, 3], [7, 4], [7, 5]
  ],
  P2: [ // Green (col 7, rows 1..5)
    [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]
  ],
  P3: [ // Yellow (row 7, cols 13..9)
    [7, 13], [7, 12], [7, 11], [7, 10], [7, 9]
  ],
  P4: [ // Blue (col 7, rows 13..9)
    [13, 7], [12, 7], [11, 7], [10, 7], [9, 7]
  ]
};

// Final Home center triangles (row 7, col 7)
export const HOME_CENTER_COORDINATE: [number, number] = [7, 7];

// Yard Token positions [row, col] on 15x15 board
export const YARD_POSITIONS: Record<PlayerSlot, [number, number][]> = {
  P1: [ // Red Yard (Bottom-Left: rows 9..14, cols 0..5)
    [10.5, 1.5], [10.5, 3.5], [12.5, 1.5], [12.5, 3.5]
  ],
  P2: [ // Green Yard (Top-Left: rows 0..5, cols 0..5)
    [1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]
  ],
  P3: [ // Yellow Yard (Top-Right: rows 0..5, cols 9..14)
    [1.5, 10.5], [1.5, 12.5], [3.5, 10.5], [3.5, 12.5]
  ],
  P4: [ // Blue Yard (Bottom-Right: rows 9..14, cols 9..14)
    [10.5, 10.5], [10.5, 12.5], [12.5, 10.5], [12.5, 12.5]
  ]
};

/**
 * Get display row/col for a token on 15x15 board
 */
export function getTokenGridCoordinates(
  slot: PlayerSlot,
  tokenId: number,
  zone: TokenZone,
  progress: number
): [number, number] {
  if (zone === 'YARD' || progress === -1) {
    const yardSlots = YARD_POSITIONS[slot];
    return yardSlots[tokenId % 4] ?? [0, 0];
  }

  if (zone === 'HOME' || progress >= FINAL_HOME_PROGRESS) {
    return HOME_CENTER_COORDINATE;
  }

  if (zone === 'HOME_PATH' || progress >= HOME_PATH_START_PROGRESS) {
    const pathIdx = progress - HOME_PATH_START_PROGRESS; // 0..4
    const pathCoords = HOME_PATHS_GRID_COORDINATES[slot];
    return pathCoords[Math.min(pathIdx, 4)] ?? HOME_CENTER_COORDINATE;
  }

  // On shared track (progress 0..50)
  const globalIdx = getGlobalTrackIndex(slot, progress);
  if (globalIdx !== null && TRACK_GRID_COORDINATES[globalIdx]) {
    return TRACK_GRID_COORDINATES[globalIdx];
  }

  return [0, 0];
}

/**
 * Generate Initial Tokens for a Game
 */
export function createInitialTokens(playerUids: string[]): GameDocument['tokens'] {
  const tokens: GameDocument['tokens'] = {};

  for (const uid of playerUids) {
    tokens[uid] = {
      '0': { id: 0, zone: 'YARD', progress: -1 },
      '1': { id: 1, zone: 'YARD', progress: -1 },
      '2': { id: 2, zone: 'YARD', progress: -1 },
      '3': { id: 3, zone: 'YARD', progress: -1 },
    };
  }

  return tokens;
}
