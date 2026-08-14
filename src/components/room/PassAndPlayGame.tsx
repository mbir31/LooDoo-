import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PlayerColor,
  PlayerSlot,
  GameMode,
  Language,
  RoomPlayer,
  GameDocument,
  UserProfile,
} from '../../types';
import { getTranslation } from '../../i18n/translations';
import {
  calculateTokenMove,
  getLegalMoves,
  hasPlayerWon,
  countTokensHome,
  createInitialTokens,
  getTokenGridCoordinates,
} from '../../game-engine/engine';
import { soundFx } from '../../utils/sound';
import { LudoBoard } from '../board/LudoBoard';
import { SnakeLadderBoard, LADDERS_MAP, SNAKES_MAP } from '../board/SnakeLadderBoard';
import { DiceComponent } from '../game/DiceComponent';
import { TurnIndicator } from '../game/TurnIndicator';
import { PlayerCard } from '../game/PlayerCard';
import { QuickReactions } from '../game/QuickReactions';
import { GameResultModal } from './GameResultModal';
import {
  Users,
  RotateCcw,
  Sparkles,
  Zap,
  Shield,
  Trophy,
  ArrowLeft,
  Crown,
  Volume2,
  Check,
} from 'lucide-react';

interface PassAndPlayGameProps {
  language: Language;
  onExit: () => void;
  currentUser: UserProfile;
}

interface LocalPlayerConfig {
  name: string;
  avatar: string;
  color: PlayerColor;
  slot: PlayerSlot;
}

const DEFAULT_PLAYERS_CONFIG: LocalPlayerConfig[] = [
  { name: 'খেলোয়াড় ১', avatar: '👑', color: 'red', slot: 'P1' },
  { name: 'খেলোয়াড় ২', avatar: '🦁', color: 'green', slot: 'P2' },
  { name: 'খেলোয়াড় ৩', avatar: '🐯', color: 'yellow', slot: 'P3' },
  { name: 'খেলোয়াড় ৪', avatar: '🦅', color: 'blue', slot: 'P4' },
];

export const PassAndPlayGame: React.FC<PassAndPlayGameProps> = ({
  language,
  onExit,
  currentUser,
}) => {
  // Setup Stage State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
  const [selectedMode, setSelectedMode] = useState<GameMode>('CLASSIC');
  const [autoMoveSingle, setAutoMoveSingle] = useState(true);
  const [playersList, setPlayersList] = useState<LocalPlayerConfig[]>(DEFAULT_PLAYERS_CONFIG);

  // Active Game State
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [diceRolled, setDiceRolled] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [consecutiveSixes, setConsecutiveSixes] = useState(0);
  const [winnerUid, setWinnerUid] = useState<string | null>(null);
  const [rankings, setRankings] = useState<Array<{ uid: string; rank: number }>>([]);
  const [turnMessage, setTurnMessage] = useState<{ bn: string; en: string; type: any } | null>(null);

  // Ludo Mode Tokens: [uid] -> { [tokenId]: { id, zone, progress } }
  const [tokens, setTokens] = useState<GameDocument['tokens']>({});

  // Snake & Ladders Positions: [uid] -> 1..100
  const [snakePositions, setSnakePositions] = useState<Record<string, number>>({});
  const [snakeLastEvent, setSnakeLastEvent] = useState<{
    type: 'LADDER' | 'SNAKE' | 'NORMAL';
    from: number;
    to: number;
    uid: string;
  } | null>(null);

  // Setup initial player records
  const activePlayers = useMemo(() => {
    return playersList.slice(0, playerCount);
  }, [playersList, playerCount]);

  const playerOrder = useMemo(() => {
    return activePlayers.map((p) => p.slot);
  }, [activePlayers]);

  const currentSlot = playerOrder[currentTurnIndex] || 'P1';
  const currentPlayer = activePlayers.find((p) => p.slot === currentSlot) || activePlayers[0];

  const playersMap = useMemo(() => {
    const map: Record<string, RoomPlayer> = {};
    activePlayers.forEach((p) => {
      map[p.slot] = {
        uid: p.slot,
        playerId: p.slot,
        slot: p.slot,
        displayName: p.name,
        color: p.color,
        avatar: p.avatar,
        ready: true,
        connected: true,
        status: 'active',
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
      };
    });
    return map;
  }, [activePlayers]);

  const slotMap = useMemo(() => {
    const map: Record<string, PlayerSlot> = {};
    activePlayers.forEach((p) => {
      map[p.slot] = p.slot;
    });
    return map;
  }, [activePlayers]);

  // Start the Local Game
  const handleStartGame = () => {
    soundFx.click();
    const initialTokens = createInitialTokens(playerOrder);
    setTokens(initialTokens);

    const initSnakes: Record<string, number> = {};
    playerOrder.forEach((slot) => {
      initSnakes[slot] = 1;
    });
    setSnakePositions(initSnakes);

    setCurrentTurnIndex(0);
    setDiceValue(null);
    setDiceRolled(false);
    setConsecutiveSixes(0);
    setWinnerUid(null);
    setRankings([]);
    setTurnMessage(null);
    setIsPlaying(true);
  };

  // Calculate tokens to win
  const tokensToWin = useMemo(() => {
    if (selectedMode === 'RUSH') return 2;
    if (selectedMode === 'TEAM') return 4;
    return 4;
  }, [selectedMode]);

  // Calculate Legal Moves for active turn
  const legalMoves = useMemo(() => {
    if (!isPlaying || !diceRolled || diceValue === null || selectedMode === 'SNAKE_LADDER') {
      return [];
    }

    return getLegalMoves(
      currentSlot,
      currentSlot,
      diceValue,
      tokens,
      slotMap,
      {
        maxPlayers: playerCount,
        turnTimeoutSeconds: 30,
        strictThreeSixRule: true,
        allowBlockades: true,
        customNamesAllowed: true,
        gameMode: selectedMode,
        tokensToWin,
        autoMoveSingle,
      }
    );
  }, [isPlaying, diceRolled, diceValue, selectedMode, currentSlot, tokens, slotMap, playerCount, tokensToWin, autoMoveSingle]);

  // Auto-move single legal move if enabled
  useEffect(() => {
    if (
      isPlaying &&
      diceRolled &&
      diceValue !== null &&
      autoMoveSingle &&
      selectedMode !== 'SNAKE_LADDER' &&
      legalMoves.length === 1 &&
      !winnerUid
    ) {
      const timer = setTimeout(() => {
        handleMoveToken(legalMoves[0]);
      }, 550);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, diceRolled, diceValue, autoMoveSingle, selectedMode, legalMoves, winnerUid]);

  // Advance to next player
  const advanceTurn = () => {
    setDiceValue(null);
    setDiceRolled(false);
    setConsecutiveSixes(0);

    const total = playerOrder.length;
    let nextIdx = (currentTurnIndex + 1) % total;

    // Check if player has already won
    if (selectedMode !== 'SNAKE_LADDER') {
      for (let i = 0; i < total; i++) {
        const checkSlot = playerOrder[nextIdx];
        if (!hasPlayerWon(checkSlot, tokens, tokensToWin)) {
          break;
        }
        nextIdx = (nextIdx + 1) % total;
      }
    }

    setCurrentTurnIndex(nextIdx);
    soundFx.myTurn();
  };

  // Roll Dice
  const handleRollDice = () => {
    if (isRolling || diceRolled || winnerUid) return;
    soundFx.diceRoll();
    setIsRolling(true);

    setTimeout(() => {
      const val = Math.floor(Math.random() * 6) + 1;
      setDiceValue(val);
      setIsRolling(false);
      setDiceRolled(true);

      // Handle Snake & Ladders mode roll
      if (selectedMode === 'SNAKE_LADDER') {
        const curPos = snakePositions[currentSlot] || 1;
        let newPos = curPos + val;

        // Exact roll needed to land on 100
        if (newPos > 100) {
          soundFx.penalty();
          setTurnMessage({
            bn: '১০০ অতিক্রম করা যাবে না! চাল অপরিবর্তিত রইল।',
            en: 'Cannot exceed 100! Turn passes.',
            type: 'penalty',
          });
          setTimeout(advanceTurn, 1200);
          return;
        }

        let eventType: 'LADDER' | 'SNAKE' | 'NORMAL' = 'NORMAL';
        let finalPos = newPos;

        if (LADDERS_MAP[newPos]) {
          finalPos = LADDERS_MAP[newPos];
          eventType = 'LADDER';
          soundFx.ladderClimb();
        } else if (SNAKES_MAP[newPos]) {
          finalPos = SNAKES_MAP[newPos];
          eventType = 'SNAKE';
          soundFx.snakeBite();
        } else {
          soundFx.tokenMoveSequence(val);
        }

        setSnakePositions((prev) => ({ ...prev, [currentSlot]: finalPos }));
        setSnakeLastEvent({ type: eventType, from: newPos, to: finalPos, uid: currentSlot });

        if (finalPos === 100) {
          soundFx.win();
          setWinnerUid(currentSlot);
          return;
        }

        // Grant extra roll on 6
        if (val === 6) {
          soundFx.sixRolled();
          setDiceRolled(false);
          setDiceValue(null);
        } else {
          setTimeout(advanceTurn, 1200);
        }
        return;
      }

      // Classic / Rush / Team Ludo Consecutive 6 rule
      if (val === 6) {
        soundFx.sixRolled();
        const nextSixCount = consecutiveSixes + 1;
        setConsecutiveSixes(nextSixCount);

        if (nextSixCount >= 3) {
          soundFx.penalty();
          setTurnMessage({
            bn: 'টানা ৩টি ছক্কা! চাল বাতিল করা হলো।',
            en: 'Three consecutive 6s! Turn cancelled.',
            type: 'penalty',
          });
          setTimeout(advanceTurn, 1400);
          return;
        }
      } else {
        setConsecutiveSixes(0);
      }

      // Calculate legal moves
      const availableMoves = getLegalMoves(
        currentSlot,
        currentSlot,
        val,
        tokens,
        slotMap,
        {
          maxPlayers: playerCount,
          turnTimeoutSeconds: 30,
          strictThreeSixRule: true,
          allowBlockades: true,
          customNamesAllowed: true,
          gameMode: selectedMode,
          tokensToWin,
          autoMoveSingle,
        }
      );

      if (availableMoves.length === 0) {
        soundFx.penalty();
        setTurnMessage({
          bn: 'কোনো বৈধ চাল নেই! পরবর্তী খেলোয়াড়ের পালা।',
          en: 'No legal moves available. Turn passing...',
          type: 'info',
        });
        setTimeout(advanceTurn, 1200);
      }
    }, 450);
  };

  // Move Token
  const handleMoveToken = (tokenId: number) => {
    if (!diceRolled || diceValue === null || winnerUid) return;

    const playerTokens = tokens[currentSlot];
    if (!playerTokens) return;
    const token = playerTokens[tokenId.toString()] || playerTokens[tokenId];
    if (!token) return;

    const move = calculateTokenMove(
      token,
      currentSlot,
      currentSlot,
      diceValue,
      tokens,
      slotMap,
      {
        maxPlayers: playerCount,
        turnTimeoutSeconds: 30,
        strictThreeSixRule: true,
        allowBlockades: true,
        customNamesAllowed: true,
        gameMode: selectedMode,
        tokensToWin,
        autoMoveSingle,
      }
    );

    if (!move.canMove) return;

    // Play move sound
    if (move.newZone === 'HOME') {
      soundFx.home();
    } else if (move.capturedTokens.length > 0) {
      soundFx.capture();
    } else {
      soundFx.tokenMoveSequence(diceValue);
    }

    // Apply token move
    const nextTokens = { ...tokens };
    nextTokens[currentSlot] = {
      ...nextTokens[currentSlot],
      [tokenId.toString()]: {
        id: tokenId,
        zone: move.newZone,
        progress: move.newProgress,
      },
    };

    // Apply Captures
    move.capturedTokens.forEach((c) => {
      if (nextTokens[c.uid]) {
        nextTokens[c.uid] = {
          ...nextTokens[c.uid],
          [c.tokenId.toString()]: {
            id: c.tokenId,
            zone: 'YARD',
            progress: -1,
          },
        };
      }
    });

    setTokens(nextTokens);

    // Check Victory
    const won = hasPlayerWon(currentSlot, nextTokens, tokensToWin);
    if (won) {
      soundFx.win();
      setWinnerUid(currentSlot);
      return;
    }

    // Check Extra Turn on 6, capture, or home
    if (move.grantsExtraTurn) {
      setDiceRolled(false);
      setDiceValue(null);
    } else {
      advanceTurn();
    }
  };

  // Mock GameDocument for LudoBoard compatibility
  const mockGameDoc: GameDocument = {
    gameId: 'local_pass_play',
    roomId: 'local_room',
    gameMode: selectedMode,
    status: diceRolled ? 'AWAITING_TOKEN_SELECTION' : 'AWAITING_ROLL',
    playerOrder,
    currentPlayerUid: currentSlot,
    turnNumber: 1,
    diceValue,
    diceRolled,
    consecutiveSixes,
    turnStartedAt: Date.now(),
    turnExpiresAt: Date.now() + 30000,
    winnerUid,
    rankings: rankings.map((r) => ({ uid: r.uid, rank: r.rank, finishedAt: Date.now() })),
    tokens,
    version: 1,
    startedAt: Date.now(),
    endedAt: winnerUid ? Date.now() : null,
    lastAction: 'pass_and_play',
    lastActionAt: Date.now(),
    turnMessage,
  };

  // ================= SETUP SCREEN =================
  if (!isPlaying) {
    return (
      <div className="w-full max-w-xl mx-auto flex flex-col gap-4 p-3 sm:p-4">
        {/* Header Bar */}
        <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 p-4 rounded-2xl shadow-xl">
          <button
            onClick={() => {
              soundFx.click();
              onExit();
            }}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{language === 'bn' ? 'ফিরে যান' : 'Back'}</span>
          </button>
          <div className="text-center">
            <h2 className="font-black text-base sm:text-lg bg-gradient-to-r from-red-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">
              {language === 'bn' ? 'এক ফোনে খেলুন (Pass & Play)' : 'Offline Pass & Play'}
            </h2>
            <p className="text-[11px] text-neutral-400">
              {language === 'bn' ? 'ইন্টারনেট ছাড়াই সবাই একসাথে এক ডিভাইসে' : 'Play locally on 1 phone without internet'}
            </p>
          </div>
          <div className="w-16" />
        </div>

        {/* Game Mode Selector */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
          <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{language === 'bn' ? 'গেম মোড বেছে নিন' : 'Choose Game Mode'}</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                soundFx.click();
                setSelectedMode('CLASSIC');
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                selectedMode === 'CLASSIC'
                  ? 'bg-amber-950/40 border-amber-400 text-white shadow-md'
                  : 'bg-black border-neutral-800 text-neutral-400 hover:bg-neutral-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-amber-400" />
                <p className="font-black text-xs text-white">{getTranslation(language, 'modeClassic')}</p>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">{getTranslation(language, 'modeClassicDesc')}</p>
            </button>

            <button
              onClick={() => {
                soundFx.click();
                setSelectedMode('RUSH');
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                selectedMode === 'RUSH'
                  ? 'bg-rose-950/40 border-rose-400 text-white shadow-md'
                  : 'bg-black border-neutral-800 text-neutral-400 hover:bg-neutral-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-rose-400" />
                <p className="font-black text-xs text-white">{getTranslation(language, 'modeRush')}</p>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">{getTranslation(language, 'modeRushDesc')}</p>
            </button>

            <button
              onClick={() => {
                soundFx.click();
                setSelectedMode('SNAKE_LADDER');
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                selectedMode === 'SNAKE_LADDER'
                  ? 'bg-emerald-950/40 border-emerald-400 text-white shadow-md'
                  : 'bg-black border-neutral-800 text-neutral-400 hover:bg-neutral-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🐍</span>
                <p className="font-black text-xs text-white">{getTranslation(language, 'snakeLadderMode')}</p>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">{getTranslation(language, 'snakeLadderModeDesc')}</p>
            </button>

            <button
              onClick={() => {
                soundFx.click();
                setSelectedMode('TEAM');
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                selectedMode === 'TEAM'
                  ? 'bg-blue-950/40 border-blue-400 text-white shadow-md'
                  : 'bg-black border-neutral-800 text-neutral-400 hover:bg-neutral-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-400" />
                <p className="font-black text-xs text-white">
                  {language === 'bn' ? '২ বনাম ২ টিম মোড' : '2v2 Team Mode'}
                </p>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">
                {language === 'bn' ? 'লাল+হলুদ বনাম সবুজ+নীল দল' : 'Red+Yellow vs Green+Blue'}
              </p>
            </button>
          </div>
        </div>

        {/* Player Count Selection */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
          <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-amber-400" />
            <span>{language === 'bn' ? 'কতজন খেলবেন?' : 'How many players?'}</span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            {[2, 3, 4].map((num) => (
              <button
                key={num}
                onClick={() => {
                  soundFx.click();
                  setPlayerCount(num as 2 | 3 | 4);
                }}
                className={`py-3 rounded-xl font-black text-sm border transition-all cursor-pointer ${
                  playerCount === num
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-black border-neutral-800 text-neutral-300 hover:bg-neutral-900'
                }`}
              >
                {num} {language === 'bn' ? 'খেলোয়াড়' : 'Players'}
              </button>
            ))}
          </div>
        </div>

        {/* Player Customizer */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
          <label className="text-xs font-bold text-neutral-300">
            {language === 'bn' ? 'খেলোয়াড়দের নাম ও প্রোফাইল' : 'Player Names & Avatars'}
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {playersList.slice(0, playerCount).map((p, idx) => {
              const borderColors: Record<PlayerColor, string> = {
                red: 'border-red-500/50 bg-red-950/20',
                green: 'border-emerald-500/50 bg-emerald-950/20',
                yellow: 'border-amber-400/50 bg-amber-950/20',
                blue: 'border-blue-500/50 bg-blue-950/20',
              };

              return (
                <div
                  key={p.slot}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${borderColors[p.color]}`}
                >
                  <span className="text-2xl p-1 bg-black rounded-lg border border-neutral-800 shadow">
                    {p.avatar}
                  </span>
                  <input
                    type="text"
                    maxLength={15}
                    value={p.name}
                    onChange={(e) => {
                      const updated = [...playersList];
                      updated[idx].name = e.target.value;
                      setPlayersList(updated);
                    }}
                    className="flex-1 bg-neutral-900 border border-neutral-750 rounded-lg px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                    placeholder={`Player ${idx + 1}`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Start Game CTA */}
        <button
          onClick={handleStartGame}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-amber-500 to-emerald-600 hover:brightness-110 active:scale-95 text-white font-black text-base shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <Crown className="w-5 h-5 text-amber-200" />
          <span>{language === 'bn' ? 'খেলা শুরু করুন' : 'Start Match'}</span>
        </button>
      </div>
    );
  }

  // ================= IN-GAME VIEW =================
  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 sm:gap-4 p-2 sm:p-4">
      {/* Top Header & Turn Bar */}
      <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 p-2.5 sm:p-3 rounded-2xl shadow-xl">
        <button
          onClick={() => {
            soundFx.click();
            setIsPlaying(false);
          }}
          className="p-1.5 sm:p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>{language === 'bn' ? 'সেটআপ' : 'Setup'}</span>
        </button>

        {/* Active Player Banner */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-black border border-neutral-800 shadow">
          <span className="text-lg">{currentPlayer.avatar}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-black text-white">{currentPlayer.name}</span>
              <span className="text-[10px] font-bold text-amber-400">
                ({currentPlayer.color.toUpperCase()})
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">
              {language === 'bn' ? 'এর চাল' : "'s Turn"}
            </p>
          </div>
        </div>

        {/* Quick Reset */}
        <button
          onClick={handleStartGame}
          className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          title="Restart"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Game Arena */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-4">
        {/* Game Board */}
        <div className="w-full max-w-[500px]">
          {selectedMode === 'SNAKE_LADDER' ? (
            <SnakeLadderBoard
              playerPositions={snakePositions}
              players={playersMap}
              playerOrder={playerOrder}
              currentPlayerUid={currentSlot}
              myUid={currentSlot}
              language={language}
              lastEvent={snakeLastEvent}
            />
          ) : (
            <LudoBoard
              game={mockGameDoc}
              players={playersMap}
              currentPlayerUid={currentSlot}
              myUid={currentSlot}
              legalMoves={legalMoves}
              onTokenClick={handleMoveToken}
              disabled={!diceRolled}
              userTokenTheme={currentUser.tokenSkin || 'classic'}
            />
          )}
        </div>

        {/* Controls & Active Players Column */}
        <div className="w-full max-w-[340px] flex flex-col gap-3">
          {/* Turn Indicator Banner */}
          <TurnIndicator
            game={mockGameDoc}
            players={playersMap}
            myUid={currentSlot}
            language={language}
          />

          {/* Interactive 3D Dice Component & Quick Soundboard Action */}
          <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-2xl shadow-xl flex flex-col items-center gap-3">
            <DiceComponent
              value={diceValue}
              isRolling={isRolling}
              isMyTurn={true}
              disabled={diceRolled || Boolean(winnerUid)}
              onRoll={handleRollDice}
              consecutiveSixes={consecutiveSixes}
              language={language}
            />

            <div className="w-full flex items-center justify-between gap-2 pt-2 border-t border-neutral-850">
              <QuickReactions
                user={currentUser}
                onOfflineReaction={(emoji, taunt) => {
                  // Handled with sound and float
                }}
              />
              <button
                onClick={() => setIsPlaying(false)}
                className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 text-xs font-bold border border-neutral-800 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'রিস্টার্ট' : 'Restart'}</span>
              </button>
            </div>
          </div>

          {/* Players Grid */}
          <div className="grid grid-cols-2 gap-2">
            {activePlayers.map((p) => {
              const isTurn = p.slot === currentSlot;
              const playerRecord = playersMap[p.slot];

              return (
                <PlayerCard
                  key={p.slot}
                  player={playerRecord}
                  isCurrentTurn={isTurn}
                  isAdmin={false}
                  game={mockGameDoc}
                  language={language}
                  isMe={isTurn}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Screen Bottom Credit Footer */}
      <footer className="w-full py-4 text-center text-xs text-neutral-400 font-medium border-t border-neutral-900 mt-6 flex flex-col sm:flex-row items-center justify-center gap-1">
        <span>Built with love, for FnF, by</span>
        <span className="text-amber-400 font-bold tracking-wide">©munabbirMushran</span>
      </footer>

      {/* Result Modal upon Victory */}
      {winnerUid && (
        <GameResultModal
          game={mockGameDoc}
          room={{
            roomId: 'pass_and_play',
            roomCode: 'LOCAL',
            adminUid: currentSlot,
            status: 'FINISHED',
            maxPlayers: playerCount,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            currentGameId: 'local_game',
            lastGameId: null,
            settings: {
              maxPlayers: playerCount,
              turnTimeoutSeconds: 30,
              strictThreeSixRule: true,
              allowBlockades: true,
              customNamesAllowed: true,
              gameMode: selectedMode,
              tokensToWin,
            },
          }}
          players={playersMap}
          currentUserUid={currentSlot}
          language={language}
          onBackToLobby={() => setIsPlaying(false)}
        />
      )}
    </div>
  );
};
