import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  UserProfile,
  RoomDocument,
  RoomPlayer,
  RoomSettings,
  GameDocument,
  GameEvent,
  GameEventType,
  PlayerColor,
  PlayerSlot,
  ReactionEvent,
  GameHistoryRecord,
} from '../types';
import {
  createInitialTokens,
  calculateTokenMove,
  getLegalMoves,
  hasPlayerWon,
  getNextPlayerUid,
  countTokensHome,
} from '../game-engine/engine';

// Helper to generate cryptographically secure dice value 1..6
export function generateSecureDice(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return 1 + Math.floor((array[0] / (0xffffffff + 1)) * 6);
}

// Generate 6-digit room code e.g. 482731
export function generateRoomCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return num.toString();
}

const DEFAULT_SETTINGS: RoomSettings = {
  maxPlayers: 4,
  turnTimeoutSeconds: 30,
  strictThreeSixRule: true, // Authentic Bangladeshi 3x consecutive 6 cancels turn
  allowBlockades: false,
  customNamesAllowed: true,
};

const SLOT_COLORS: Record<PlayerSlot, PlayerColor> = {
  P1: 'red',
  P2: 'green',
  P3: 'yellow',
  P4: 'blue',
};

const ALL_SLOTS: PlayerSlot[] = ['P1', 'P2', 'P3', 'P4'];

/**
 * Creates a persistent Room in Firestore
 */
export async function createRoom(
  user: UserProfile,
  maxPlayers: 2 | 3 | 4 = 4,
  customSettings?: Partial<RoomSettings>
): Promise<{ roomId: string; roomCode: string }> {
  const roomCode = generateRoomCode();
  const roomRef = doc(collection(db, 'rooms'));
  const roomId = roomRef.id;

  const settings: RoomSettings = {
    ...DEFAULT_SETTINGS,
    maxPlayers,
    ...customSettings,
  };

  const roomData: RoomDocument = {
    roomId,
    roomCode,
    adminUid: user.uid,
    status: 'OPEN',
    maxPlayers,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    currentGameId: null,
    lastGameId: null,
    settings,
  };

  await setDoc(roomRef, roomData);

  // Add Creator as P1 Room Admin
  const playerRef = doc(db, 'rooms', roomId, 'players', user.uid);
  const p1Player: RoomPlayer = {
    uid: user.uid,
    playerId: `P1-${roomCode}`,
    slot: 'P1',
    displayName: user.displayName,
    color: 'red',
    avatar: user.avatar,
    ready: true,
    connected: true,
    status: 'active',
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
    voiceEnabled: false,
  };

  await setDoc(playerRef, p1Player);

  // Update user's active room
  await updateDoc(doc(db, 'users', user.uid), {
    activeRoomId: roomId,
    lastSeenAt: Date.now(),
  }).catch(() => {});

  return { roomId, roomCode };
}

/**
 * Creates a Solo Room with automated system bot players and immediately starts the game
 */
export async function createSoloRoom(
  user: UserProfile,
  botCount: 1 | 3 = 1
): Promise<{ roomId: string; roomCode: string }> {
  const roomCode = generateRoomCode();
  const roomRef = doc(collection(db, 'rooms'));
  const roomId = roomRef.id;
  const maxPlayers = (botCount === 1 ? 2 : 4) as 2 | 4;

  const settings: RoomSettings = {
    ...DEFAULT_SETTINGS,
    maxPlayers,
    turnTimeoutSeconds: 30,
    strictThreeSixRule: true,
  };

  const roomData: RoomDocument = {
    roomId,
    roomCode,
    adminUid: user.uid,
    status: 'OPEN',
    maxPlayers,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    currentGameId: null,
    lastGameId: null,
    settings,
  };

  await setDoc(roomRef, roomData);

  // 1. Add Human Player (P1)
  const playerRef = doc(db, 'rooms', roomId, 'players', user.uid);
  const p1Player: RoomPlayer = {
    uid: user.uid,
    playerId: `P1-${roomCode}`,
    slot: 'P1',
    displayName: user.displayName || 'Player 1',
    color: 'red',
    avatar: user.avatar || '🦁',
    ready: true,
    connected: true,
    status: 'active',
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
    voiceEnabled: false,
  };
  await setDoc(playerRef, p1Player);

  // 2. Add Automated System Bot Players
  const botSlots: { slot: PlayerSlot; color: PlayerColor; name: string; avatar: string; uid: string }[] = [
    { slot: 'P2', color: 'green', name: 'রোবট সবুজ 🤖', avatar: '🤖', uid: `bot_${roomId}_p2` },
    { slot: 'P3', color: 'yellow', name: 'রোবট হলুদ ⚡', avatar: '⚡', uid: `bot_${roomId}_p3` },
    { slot: 'P4', color: 'blue', name: 'রোবট নীল 🎯', avatar: '🎯', uid: `bot_${roomId}_p4` },
  ];

  const selectedBots = botSlots.slice(0, botCount);
  for (const bot of selectedBots) {
    const botRef = doc(db, 'rooms', roomId, 'players', bot.uid);
    const botPlayer: RoomPlayer = {
      uid: bot.uid,
      playerId: `${bot.slot}-${roomCode}`,
      slot: bot.slot,
      displayName: bot.name,
      color: bot.color,
      avatar: bot.avatar,
      ready: true,
      connected: true,
      status: 'active',
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
      voiceEnabled: false,
    };
    await setDoc(botRef, botPlayer);
  }

  // Update user's active room
  await updateDoc(doc(db, 'users', user.uid), {
    activeRoomId: roomId,
    lastSeenAt: Date.now(),
  }).catch(() => {});

  // 3. Immediately start the game so player goes directly to the board
  await startGame(roomId, user.uid);

  return { roomId, roomCode };
}

/**
 * Joins an existing room using 6-digit code or Room ID
 */
export async function joinRoom(
  codeOrId: string,
  user: UserProfile
): Promise<{ roomId: string; slot: PlayerSlot }> {
  const cleanCode = codeOrId.trim();

  // Try finding by roomCode or doc id
  let roomId = cleanCode;
  let roomDoc = await getDoc(doc(db, 'rooms', roomId));

  if (!roomDoc.exists()) {
    // Query by roomCode
    const q = query(
      collection(db, 'rooms'),
      where('roomCode', '==', cleanCode),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      throw new Error('errorRoomNotFound');
    }
    roomDoc = snap.docs[0];
    roomId = roomDoc.id;
  }

  const roomData = roomDoc.data() as RoomDocument;

  // Use transaction to join and allocate slot safely
  const result = await runTransaction(db, async (transaction) => {
    const freshRoomSnap = await transaction.get(doc(db, 'rooms', roomId));
    if (!freshRoomSnap.exists()) {
      throw new Error('errorRoomNotFound');
    }

    const currentRoom = freshRoomSnap.data() as RoomDocument;
    if (currentRoom.status === 'ARCHIVED') {
      throw new Error('errorRoomNotFound');
    }

    // Check if player is already in the room
    const playerRef = doc(db, 'rooms', roomId, 'players', user.uid);
    const playerSnap = await transaction.get(playerRef);

    if (playerSnap.exists()) {
      const existingPlayer = playerSnap.data() as RoomPlayer;
      // Re-activate player
      transaction.update(playerRef, {
        connected: true,
        status: 'active',
        lastSeenAt: Date.now(),
        displayName: user.displayName || existingPlayer.displayName,
        avatar: user.avatar || existingPlayer.avatar,
      });
      return { roomId, slot: existingPlayer.slot };
    }

    // Fetch existing players
    const playersQuery = query(collection(db, 'rooms', roomId, 'players'));
    const playersSnap = await getDocs(playersQuery);
    const existingPlayers = playersSnap.docs.map((d) => d.data() as RoomPlayer);

    const activePlayers = existingPlayers.filter((p) => p.status !== 'left');
    if (activePlayers.length >= currentRoom.maxPlayers) {
      throw new Error('errorRoomFull');
    }

    // Find first available slot
    const occupiedSlots = new Set(activePlayers.map((p) => p.slot));
    const availableSlot = ALL_SLOTS.slice(0, currentRoom.maxPlayers).find(
      (slot) => !occupiedSlots.has(slot)
    );

    if (!availableSlot) {
      throw new Error('errorRoomFull');
    }

    const assignedColor = SLOT_COLORS[availableSlot];

    const newPlayer: RoomPlayer = {
      uid: user.uid,
      playerId: `${availableSlot}-${currentRoom.roomCode}`,
      slot: availableSlot,
      displayName: user.displayName,
      color: assignedColor,
      avatar: user.avatar,
      ready: false,
      connected: true,
      status: 'active',
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
      voiceEnabled: false,
    };

    transaction.set(playerRef, newPlayer);
    transaction.update(doc(db, 'rooms', roomId), {
      updatedAt: Date.now(),
    });

    return { roomId, slot: availableSlot };
  });

  // Update user's active room
  await updateDoc(doc(db, 'users', user.uid), {
    activeRoomId: roomId,
    lastSeenAt: Date.now(),
  }).catch(() => {});

  return result;
}

/**
 * Toggle Ready state
 */
export async function togglePlayerReady(
  roomId: string,
  uid: string,
  ready: boolean
): Promise<void> {
  const playerRef = doc(db, 'rooms', roomId, 'players', uid);
  await updateDoc(playerRef, { ready, lastSeenAt: Date.now() });
}

/**
 * Update Player Color / Name (Admin or Self)
 */
export async function updatePlayerConfig(
  roomId: string,
  targetUid: string,
  updates: { displayName?: string; color?: PlayerColor; customColorHex?: string }
): Promise<void> {
  const playerRef = doc(db, 'rooms', roomId, 'players', targetUid);
  await updateDoc(playerRef, {
    ...updates,
    lastSeenAt: Date.now(),
  });
}

/**
 * Starts a new Game inside a Room (Admin privilege)
 */
export async function startGame(roomId: string, adminUid: string): Promise<string> {
  return await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await transaction.get(roomRef);
    if (!roomSnap.exists()) throw new Error('errorRoomNotFound');

    const roomData = roomSnap.data() as RoomDocument;
    if (roomData.adminUid !== adminUid) {
      throw new Error('errorNotAdmin');
    }

    // Fetch players
    const playersSnap = await getDocs(collection(db, 'rooms', roomId, 'players'));
    const players = playersSnap.docs
      .map((d) => d.data() as RoomPlayer)
      .filter((p) => p.status === 'active');

    if (players.length < 2) {
      throw new Error('Minimum 2 players required to start');
    }

    // Sort players by slot P1, P2, P3, P4
    players.sort((a, b) => a.slot.localeCompare(b.slot));
    const playerOrder = players.map((p) => p.uid);

    const gameId = `game_${Date.now()}`;
    const gameRef = doc(db, 'rooms', roomId, 'games', gameId);

    const initialTokens = createInitialTokens(playerOrder);

    const turnTimeout = (roomData.settings.turnTimeoutSeconds || 30) * 1000;
    const now = Date.now();

    const gameData: GameDocument = {
      gameId,
      roomId,
      status: 'AWAITING_ROLL',
      playerOrder,
      currentPlayerUid: playerOrder[0],
      turnNumber: 1,
      diceValue: null,
      diceRolled: false,
      consecutiveSixes: 0,
      turnStartedAt: now,
      turnExpiresAt: now + turnTimeout,
      winnerUid: null,
      rankings: [],
      tokens: initialTokens,
      version: 1,
      startedAt: now,
      endedAt: null,
      lastAction: 'GAME_STARTED',
      lastActionAt: now,
      turnMessage: {
        en: 'Game started! Red player rolls first.',
        bn: 'খেলা শুরু হয়েছে! লাল খেলোয়াড় প্রথমে চালবেন।',
        type: 'info',
      },
    };

    transaction.set(gameRef, gameData);
    transaction.update(roomRef, {
      currentGameId: gameId,
      status: 'PLAYING',
      updatedAt: now,
    });

    // Record Event
    const eventRef = doc(collection(db, 'rooms', roomId, 'games', gameId, 'events'));
    transaction.set(eventRef, {
      id: eventRef.id,
      gameId,
      type: 'GAME_STARTED' as GameEventType,
      uid: adminUid,
      timestamp: now,
      messageEn: 'Game has started!',
      messageBn: 'খেলা শুরু হয়েছে!',
    });

    return gameId;
  });
}

/**
 * Roll Dice (Server-Authoritative with 3-consecutive-sixes logic)
 */
export async function rollDice(
  roomId: string,
  gameId: string,
  user: UserProfile,
  expectedVersion: number
): Promise<{ diceValue: number; legalMoves: number[] }> {
  return await runTransaction(db, async (transaction) => {
    const gameRef = doc(db, 'rooms', roomId, 'games', gameId);
    const gameSnap = await transaction.get(gameRef);
    if (!gameSnap.exists()) throw new Error('Game not found');

    const game = gameSnap.data() as GameDocument;
    if (game.currentPlayerUid !== user.uid) {
      throw new Error('errorNotYourTurn');
    }
    if (game.status !== 'AWAITING_ROLL' && game.status !== 'EXTRA_ROLL') {
      throw new Error('Invalid game status for roll');
    }
    if (game.diceRolled) {
      throw new Error('Dice already rolled for this turn');
    }
    if (game.version !== expectedVersion) {
      throw new Error('State out of sync. Please retry.');
    }

    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await transaction.get(roomRef);
    const room = roomSnap.data() as RoomDocument;

    // Fetch players to build slotMap
    const playersSnap = await getDocs(collection(db, 'rooms', roomId, 'players'));
    const slotMap: Record<string, PlayerSlot> = {};
    const nameMap: Record<string, string> = {};
    playersSnap.docs.forEach((d) => {
      const p = d.data() as RoomPlayer;
      slotMap[p.uid] = p.slot;
      nameMap[p.uid] = p.displayName;
    });

    const playerSlot = slotMap[user.uid] || 'P1';

    // Generate secure random dice
    const diceValue = generateSecureDice();
    const now = Date.now();
    const turnTimeout = (room.settings.turnTimeoutSeconds || 30) * 1000;

    let consecutiveSixes = game.consecutiveSixes || 0;
    if (diceValue === 6) {
      consecutiveSixes += 1;
    } else {
      consecutiveSixes = 0;
    }

    // MANDATORY BANGLADESHI RULE: 3 Consecutive Sixes Penalty!
    if (consecutiveSixes === 3 && room.settings.strictThreeSixRule) {
      const nextUid = getNextPlayerUid(game.playerOrder, user.uid, game.tokens);
      const nextSlot = slotMap[nextUid] || 'P1';

      transaction.update(gameRef, {
        diceValue: 6,
        diceRolled: false,
        consecutiveSixes: 0,
        currentPlayerUid: nextUid,
        turnNumber: game.turnNumber + 1,
        status: 'AWAITING_ROLL',
        turnStartedAt: now,
        turnExpiresAt: now + turnTimeout,
        version: game.version + 1,
        lastAction: 'THREE_SIX_PENALTY',
        lastActionAt: now,
        turnMessage: {
          en: 'Three 6s in a row! Turn cancelled and passed.',
          bn: 'পরপর ৩ বার ৬! চাল বাতিল এবং পরবর্তী খেলোয়াড়ের পালা।',
          type: 'penalty',
        },
      });

      const eventRef = doc(collection(db, 'rooms', roomId, 'games', gameId, 'events'));
      transaction.set(eventRef, {
        id: eventRef.id,
        gameId,
        type: 'THREE_SIX_PENALTY' as GameEventType,
        uid: user.uid,
        slot: playerSlot,
        timestamp: now,
        messageEn: `${nameMap[user.uid] || 'Player'} rolled three consecutive 6s! Turn forfeited.`,
        messageBn: `${nameMap[user.uid] || 'খেলোয়াড়'} পরপর ৩ বার ৬ ফেলায় চাল বাতিল হয়েছে!`,
      });

      return { diceValue, legalMoves: [] };
    }

    // Calculate legal moves
    const legalMoves = getLegalMoves(
      user.uid,
      playerSlot,
      diceValue,
      game.tokens,
      slotMap,
      room.settings
    );

    // If NO legal moves available:
    if (legalMoves.length === 0) {
      if (diceValue === 6) {
        // Player rolled a 6 but had no moves, they get an extra roll
        transaction.update(gameRef, {
          diceValue,
          diceRolled: false,
          consecutiveSixes,
          status: 'EXTRA_ROLL',
          turnStartedAt: now,
          turnExpiresAt: now + turnTimeout,
          version: game.version + 1,
          lastAction: 'DICE_ROLLED_EXTRA_NO_MOVES',
          lastActionAt: now,
          turnMessage: {
            en: 'Rolled 6 with no movable tokens! Roll again.',
            bn: '৬ পড়েছে কিন্তু চালার মতো ঘুঁটি নেই! আবার চালুন।',
            type: 'six',
          },
        });
      } else {
        // Turn passes to next player
        const nextUid = getNextPlayerUid(game.playerOrder, user.uid, game.tokens);
        transaction.update(gameRef, {
          diceValue,
          diceRolled: false,
          consecutiveSixes: 0,
          currentPlayerUid: nextUid,
          turnNumber: game.turnNumber + 1,
          status: 'AWAITING_ROLL',
          turnStartedAt: now,
          turnExpiresAt: now + turnTimeout,
          version: game.version + 1,
          lastAction: 'NO_LEGAL_MOVES',
          lastActionAt: now,
          turnMessage: {
            en: `Rolled ${diceValue}. No legal moves available. Turn passed.`,
            bn: `${diceValue} পড়েছে। চাল দেওয়ার ঘুঁটি নেই, চাল পাস হয়েছে।`,
            type: 'info',
          },
        });
      }

      return { diceValue, legalMoves: [] };
    }

    // Legal moves available -> AWAITING_TOKEN_SELECTION
    transaction.update(gameRef, {
      diceValue,
      diceRolled: true,
      consecutiveSixes,
      status: 'AWAITING_TOKEN_SELECTION',
      turnStartedAt: now,
      turnExpiresAt: now + turnTimeout,
      version: game.version + 1,
      lastAction: 'DICE_ROLLED',
      lastActionAt: now,
      turnMessage: {
        en: `Rolled ${diceValue}. Select a highlighted token to move.`,
        bn: `${diceValue} পড়েছে। চালার জন্য হাইলাইট করা ঘুঁটি নির্বাচন করুন।`,
        type: diceValue === 6 ? 'six' : 'info',
      },
    });

    return { diceValue, legalMoves };
  });
}

/**
 * Move Token (Server-Authoritative movement, capture resolution, home entry, win calculation)
 */
export async function moveToken(
  roomId: string,
  gameId: string,
  user: UserProfile,
  tokenId: number,
  expectedVersion: number
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const gameRef = doc(db, 'rooms', roomId, 'games', gameId);
    const gameSnap = await transaction.get(gameRef);
    if (!gameSnap.exists()) throw new Error('Game not found');

    const game = gameSnap.data() as GameDocument;
    if (game.currentPlayerUid !== user.uid) {
      throw new Error('errorNotYourTurn');
    }
    if (game.status !== 'AWAITING_TOKEN_SELECTION') {
      throw new Error('Not in token selection phase');
    }
    if (!game.diceRolled || game.diceValue === null) {
      throw new Error('Dice not rolled');
    }
    if (game.version !== expectedVersion) {
      throw new Error('State out of sync. Please retry.');
    }

    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await transaction.get(roomRef);
    const room = roomSnap.data() as RoomDocument;

    // Fetch players for slot mapping and display names
    const playersSnap = await getDocs(collection(db, 'rooms', roomId, 'players'));
    const slotMap: Record<string, PlayerSlot> = {};
    const nameMap: Record<string, string> = {};
    playersSnap.docs.forEach((d) => {
      const p = d.data() as RoomPlayer;
      slotMap[p.uid] = p.slot;
      nameMap[p.uid] = p.displayName;
    });

    const playerSlot = slotMap[user.uid] || 'P1';
    const playerTokens = game.tokens[user.uid];
    if (!playerTokens) throw new Error('Tokens not found for player');

    const token = playerTokens[tokenId.toString()] || playerTokens[tokenId];
    if (!token) throw new Error('Token does not exist');

    // Calculate move
    const moveCalc = calculateTokenMove(
      token,
      playerSlot,
      user.uid,
      game.diceValue,
      game.tokens,
      slotMap,
      room.settings
    );

    if (!moveCalc.canMove) {
      throw new Error(moveCalc.reason || 'errorInvalidMove');
    }

    // Clone tokens object
    const updatedTokens: GameDocument['tokens'] = JSON.parse(JSON.stringify(game.tokens));
    updatedTokens[user.uid][tokenId.toString()] = {
      id: tokenId,
      zone: moveCalc.newZone,
      progress: moveCalc.newProgress,
    };

    const now = Date.now();
    const turnTimeout = (room.settings.turnTimeoutSeconds || 30) * 1000;

    // Handle captures
    let lastCapturedToken: GameDocument['lastCapturedToken'] = null;
    if (moveCalc.capturedTokens.length > 0) {
      for (const cap of moveCalc.capturedTokens) {
        updatedTokens[cap.uid][cap.tokenId.toString()] = {
          id: cap.tokenId,
          zone: 'YARD',
          progress: -1,
        };
        lastCapturedToken = {
          capturedUid: cap.uid,
          tokenId: cap.tokenId,
        };

        // Record capture event
        const capEventRef = doc(collection(db, 'rooms', roomId, 'games', gameId, 'events'));
        transaction.set(capEventRef, {
          id: capEventRef.id,
          gameId,
          type: 'TOKEN_CAPTURED' as GameEventType,
          uid: user.uid,
          slot: playerSlot,
          timestamp: now,
          payload: { capturedUid: cap.uid, tokenId: cap.tokenId },
          messageEn: `${nameMap[user.uid]} captured ${nameMap[cap.uid]}'s token!`,
          messageBn: `${nameMap[user.uid]} ${nameMap[cap.uid]}-এর ঘুঁটি কেটে দিয়েছে!`,
        });
      }
    }

    // Record Home Entry event
    if (moveCalc.isHome) {
      const homeEventRef = doc(collection(db, 'rooms', roomId, 'games', gameId, 'events'));
      transaction.set(homeEventRef, {
        id: homeEventRef.id,
        gameId,
        type: 'TOKEN_HOME' as GameEventType,
        uid: user.uid,
        slot: playerSlot,
        timestamp: now,
        payload: { tokenId },
        messageEn: `${nameMap[user.uid]}'s token reached Home!`,
        messageBn: `${nameMap[user.uid]}-এর ঘুঁটি ঘরে পৌঁছেছে!`,
      });
    }

    // Check if player won
    const tokensToWin = room.settings.tokensToWin || (room.settings.gameMode === 'RUSH' ? 2 : 4);
    const won = hasPlayerWon(user.uid, updatedTokens, tokensToWin);
    if (won) {
      // Record finish ranking
      const updatedRankings = [
        ...game.rankings,
        { uid: user.uid, rank: game.rankings.length + 1, finishedAt: now },
      ];

      // Game is finished when 1st player wins
      transaction.update(gameRef, {
        tokens: updatedTokens,
        winnerUid: user.uid,
        rankings: updatedRankings,
        status: 'GAME_OVER',
        endedAt: now,
        version: game.version + 1,
        lastAction: 'GAME_FINISHED',
        lastActionAt: now,
        turnMessage: {
          en: `${nameMap[user.uid]} won the match! 🎉`,
          bn: `${nameMap[user.uid]} খেলায় বিজয়ী হয়েছেন! 🎉`,
          type: 'win',
        },
      });

      transaction.update(roomRef, {
        status: 'FINISHED',
        lastGameId: gameId,
        updatedAt: now,
      });

      // Save to Game History
      const historyRef = doc(db, 'rooms', roomId, 'history', gameId);
      const historyRecord: GameHistoryRecord = {
        gameId,
        roomId,
        roomCode: room.roomCode,
        playedAt: game.startedAt,
        durationSeconds: Math.round((now - game.startedAt) / 1000),
        winnerUid: user.uid,
        winnerName: nameMap[user.uid] || 'Player',
        winnerColor: (slotMap[user.uid] ? SLOT_COLORS[slotMap[user.uid]] : 'red'),
        gameMode: room.settings.gameMode || 'CLASSIC',
        players: game.playerOrder.map((pUid) => ({
          uid: pUid,
          displayName: nameMap[pUid] || 'Player',
          color: slotMap[pUid] ? SLOT_COLORS[slotMap[pUid]] : 'red',
          tokensHome: countTokensHome(pUid, updatedTokens),
        })),
      };
      transaction.set(historyRef, historyRecord);

      const winEventRef = doc(collection(db, 'rooms', roomId, 'games', gameId, 'events'));
      transaction.set(winEventRef, {
        id: winEventRef.id,
        gameId,
        type: 'GAME_FINISHED' as GameEventType,
        uid: user.uid,
        slot: playerSlot,
        timestamp: now,
        messageEn: `🏆 ${nameMap[user.uid]} is the Champion!`,
        messageBn: `🏆 ${nameMap[user.uid]} চ্যাম্পিয়ন হয়েছেন!`,
      });

      return;
    }

    // Determine next state: Extra Roll or Next Player
    if (moveCalc.grantsExtraTurn) {
      transaction.update(gameRef, {
        tokens: updatedTokens,
        diceValue: null,
        diceRolled: false,
        status: 'AWAITING_ROLL',
        lastCapturedToken,
        turnStartedAt: now,
        turnExpiresAt: now + turnTimeout,
        version: game.version + 1,
        lastAction: 'EXTRA_TURN_GRANTED',
        lastActionAt: now,
        turnMessage: {
          en: moveCalc.capturedTokens.length > 0
            ? 'Captured token! Extra roll granted.'
            : game.diceValue === 6
            ? 'Rolled 6! Extra roll granted.'
            : 'Token reached Home! Extra roll granted.',
          bn: moveCalc.capturedTokens.length > 0
            ? 'ঘুঁটি কেটে অতিরিক্ত চাল পেয়েছেন!'
            : game.diceValue === 6
            ? '৬ ফেলায় অতিরিক্ত চাল পেয়েছেন!'
            : 'ঘুঁটি ঘরে ঢুকে অতিরিক্ত চাল পেয়েছেন!',
          type: moveCalc.capturedTokens.length > 0 ? 'capture' : 'six',
        },
      });
    } else {
      const nextUid = getNextPlayerUid(game.playerOrder, user.uid, updatedTokens, tokensToWin);
      transaction.update(gameRef, {
        tokens: updatedTokens,
        diceValue: null,
        diceRolled: false,
        consecutiveSixes: 0,
        currentPlayerUid: nextUid,
        turnNumber: game.turnNumber + 1,
        status: 'AWAITING_ROLL',
        lastCapturedToken,
        turnStartedAt: now,
        turnExpiresAt: now + turnTimeout,
        version: game.version + 1,
        lastAction: 'TURN_PASSED',
        lastActionAt: now,
        turnMessage: {
          en: `Turn passed to ${nameMap[nextUid] || 'next player'}.`,
          bn: `${nameMap[nextUid] || 'পরবর্তী খেলোয়াড়'}-এর চাল।`,
          type: 'info',
        },
      });
    }
  });
}

/**
 * Handle Turn Timeout safely
 */
export async function handleTurnTimeout(roomId: string, gameId: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const gameRef = doc(db, 'rooms', roomId, 'games', gameId);
    const gameSnap = await transaction.get(gameRef);
    if (!gameSnap.exists()) return;

    const game = gameSnap.data() as GameDocument;
    if (game.status === 'GAME_OVER') return;

    const now = Date.now();
    if (now < game.turnExpiresAt) return; // not expired yet

    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await transaction.get(roomRef);
    const room = roomSnap.data() as RoomDocument;
    const turnTimeout = (room.settings.turnTimeoutSeconds || 30) * 1000;
    const tokensToWin = room.settings.tokensToWin || (room.settings.gameMode === 'RUSH' ? 2 : 4);

    const nextUid = getNextPlayerUid(game.playerOrder, game.currentPlayerUid, game.tokens, tokensToWin);

    transaction.update(gameRef, {
      diceValue: null,
      diceRolled: false,
      consecutiveSixes: 0,
      currentPlayerUid: nextUid,
      turnNumber: game.turnNumber + 1,
      status: 'AWAITING_ROLL',
      turnStartedAt: now,
      turnExpiresAt: now + turnTimeout,
      version: game.version + 1,
      lastAction: 'TURN_TIMEOUT',
      lastActionAt: now,
      turnMessage: {
        en: 'Turn timed out! Passed to next player.',
        bn: 'সময় শেষ! চাল পরবর্তী খেলোয়াড়কে দেওয়া হয়েছে।',
        type: 'penalty',
      },
    });
  });
}

/**
 * Start Rematch in same Room (Admin privilege)
 */
export async function startRematch(roomId: string, adminUid: string): Promise<string> {
  return await startGame(roomId, adminUid);
}

/**
 * Leave Room
 */
export async function leaveRoom(roomId: string, uid: string): Promise<void> {
  const playerRef = doc(db, 'rooms', roomId, 'players', uid);
  await updateDoc(playerRef, {
    status: 'left',
    connected: false,
    ready: false,
    lastSeenAt: Date.now(),
  }).catch(() => {});

  await updateDoc(doc(db, 'users', uid), {
    activeRoomId: null,
    lastSeenAt: Date.now(),
  }).catch(() => {});
}

/**
 * Broadcast ephemeral Quick Reaction or Bangla Audio Taunt
 */
export async function sendReaction(
  roomId: string,
  user: UserProfile,
  emoji: string,
  taunt?: { id: string; textBn: string; textEn: string }
): Promise<void> {
  const reactionRef = doc(collection(db, 'rooms', roomId, 'reactions'));
  const reaction: ReactionEvent = {
    id: reactionRef.id,
    uid: user.uid,
    displayName: user.displayName,
    emoji,
    tauntId: taunt?.id,
    tauntTextBn: taunt?.textBn,
    tauntTextEn: taunt?.textEn,
    timestamp: Date.now(),
  };
  await setDoc(reactionRef, reaction);
}
