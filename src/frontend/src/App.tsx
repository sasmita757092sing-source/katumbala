import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useHighScore, useSubmitScore, useTopScores } from "./hooks/useQueries";

// ─── Game constants ───────────────────────────────────────────────────────────
const GRID_COLS = 20;
const GRID_ROWS = 20;
const BASE_SPEED = 150; // ms per tick

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

interface Point {
  x: number;
  y: number;
}

type GameState = "start" | "playing" | "gameover";

// ─── Color constants (literal values for Canvas API) ──────────────────────────
const COLOR_GAME_BG = "#0a0a14";
const COLOR_GRID = "#151528";
const COLOR_SNAKE_HEAD = "#b8ff8a";
// const COLOR_SNAKE_BODY = "#4dff7c"; // gradient computed inline
const COLOR_SNAKE_OUTLINE = "#22cc44";
const COLOR_FOOD = "#ff5533";
const COLOR_FOOD_GLOW = "#ff8855";
const COLOR_BORDER = "#22cc44";

function randomPoint(snake: Point[]): Point {
  let pt: Point;
  do {
    pt = {
      x: Math.floor(Math.random() * GRID_COLS),
      y: Math.floor(Math.random() * GRID_ROWS),
    };
  } while (snake.some((s) => s.x === pt.x && s.y === pt.y));
  return pt;
}

function getSpeed(score: number): number {
  // Speed increases every 50 points, cap at 60ms
  const level = Math.floor(score / 50);
  return Math.max(60, BASE_SPEED - level * 15);
}

// ─── Leaderboard component ────────────────────────────────────────────────────
function Leaderboard() {
  const { data: scores, isLoading } = useTopScores();

  return (
    <div className="w-full max-w-sm mx-auto mt-6">
      <h3
        className="mono-font text-xs tracking-widest uppercase mb-3"
        style={{ color: "oklch(0.72 0.28 335)" }}
      >
        🏆 शीर्ष खिलाड़ी (Top Players)
      </h3>
      {isLoading ? (
        <div className="space-y-2" data-ocid="game.loading_state">
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              className="h-8 w-full rounded"
              style={{ background: "oklch(0.18 0.02 260)" }}
            />
          ))}
        </div>
      ) : !scores || scores.length === 0 ? (
        <p
          className="mono-font text-xs text-center py-4"
          style={{ color: "oklch(0.45 0.04 260)" }}
        >
          अभी तक कोई स्कोर नहीं • No scores yet
        </p>
      ) : (
        <div className="space-y-1">
          {scores.slice(0, 10).map((entry, i) => {
            const ocid = `leaderboard.item.${i + 1}` as
              | "leaderboard.item.1"
              | "leaderboard.item.2"
              | "leaderboard.item.3"
              | "leaderboard.item.4"
              | "leaderboard.item.5"
              | "leaderboard.item.6"
              | "leaderboard.item.7"
              | "leaderboard.item.8"
              | "leaderboard.item.9"
              | "leaderboard.item.10";
            return (
              <div
                key={`lb-${i}-${entry.name}`}
                data-ocid={ocid}
                className="leaderboard-row flex items-center justify-between px-3 py-1.5 rounded"
                style={{ border: "1px solid oklch(0.25 0.04 260)" }}
              >
                <span
                  className="mono-font text-xs font-bold w-6"
                  style={{
                    color:
                      i === 0
                        ? "oklch(0.88 0.22 90)"
                        : i === 1
                          ? "oklch(0.75 0.05 260)"
                          : i === 2
                            ? "oklch(0.65 0.15 45)"
                            : "oklch(0.45 0.04 260)",
                  }}
                >
                  {i + 1}
                </span>
                <span
                  className="mono-font text-xs flex-1 truncate px-2"
                  style={{ color: "oklch(0.82 0.08 260)" }}
                >
                  {entry.name || "Anonymous"}
                </span>
                <span
                  className="mono-font text-sm font-bold"
                  style={{ color: "oklch(0.82 0.25 145)" }}
                >
                  {Number(entry.score)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── D-pad component ──────────────────────────────────────────────────────────
interface DPadProps {
  onDirection: (dir: Direction) => void;
}

function DPad({ onDirection }: DPadProps) {
  const handleTap = useCallback(
    (dir: Direction) => (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      onDirection(dir);
    },
    [onDirection],
  );

  return (
    <div className="flex flex-col items-center gap-1 mt-4 select-none">
      <button
        type="button"
        className="dpad-btn"
        onTouchStart={handleTap("UP")}
        onMouseDown={handleTap("UP")}
        aria-label="Move up"
      >
        ▲
      </button>
      <div className="flex gap-1">
        <button
          type="button"
          className="dpad-btn"
          onTouchStart={handleTap("LEFT")}
          onMouseDown={handleTap("LEFT")}
          aria-label="Move left"
        >
          ◀
        </button>
        <div
          className="dpad-btn"
          style={{ background: "oklch(0.1 0.01 260)", cursor: "default" }}
        >
          ✦
        </div>
        <button
          type="button"
          className="dpad-btn"
          onTouchStart={handleTap("RIGHT")}
          onMouseDown={handleTap("RIGHT")}
          aria-label="Move right"
        >
          ▶
        </button>
      </div>
      <button
        type="button"
        className="dpad-btn"
        onTouchStart={handleTap("DOWN")}
        onMouseDown={handleTap("DOWN")}
        aria-label="Move down"
      >
        ▼
      </button>
    </div>
  );
}

// ─── Canvas Game Board ────────────────────────────────────────────────────────
function drawBoard(
  ctx: CanvasRenderingContext2D,
  snake: Point[],
  food: Point,
  size: number,
) {
  const cellW = size / GRID_COLS;
  const cellH = size / GRID_ROWS;

  // Background
  ctx.fillStyle = COLOR_GAME_BG;
  ctx.fillRect(0, 0, size, size);

  // Grid lines
  ctx.strokeStyle = COLOR_GRID;
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= GRID_COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cellW, 0);
    ctx.lineTo(x * cellW, size);
    ctx.stroke();
  }
  for (let y = 0; y <= GRID_ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellH);
    ctx.lineTo(size, y * cellH);
    ctx.stroke();
  }

  // Food
  const fx = food.x * cellW + cellW / 2;
  const fy = food.y * cellH + cellH / 2;
  const fr = (Math.min(cellW, cellH) / 2) * 0.65;

  // Food glow
  const foodGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr * 2.5);
  foodGrad.addColorStop(0, `${COLOR_FOOD_GLOW}88`);
  foodGrad.addColorStop(1, "transparent");
  ctx.fillStyle = foodGrad;
  ctx.beginPath();
  ctx.arc(fx, fy, fr * 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Food circle
  ctx.fillStyle = COLOR_FOOD;
  ctx.shadowColor = COLOR_FOOD_GLOW;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(fx, fy, fr, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Snake segments
  snake.forEach((seg, idx) => {
    const sx = seg.x * cellW;
    const sy = seg.y * cellH;
    const padding = 1;
    const rx = sx + padding;
    const ry = sy + padding;
    const rw = cellW - padding * 2;
    const rh = cellH - padding * 2;
    const radius = 3;

    const isHead = idx === 0;
    const t = 1 - idx / Math.max(snake.length - 1, 1);

    // Color gradient from head to tail
    const r = Math.round(isHead ? 0xb8 : 0x22 + t * (0x4d - 0x22));
    const g = Math.round(isHead ? 0xff : 0xcc + t * (0xff - 0xcc));
    const b = Math.round(isHead ? 0x8a : 0x44 + t * (0x7c - 0x44));
    ctx.fillStyle = isHead ? COLOR_SNAKE_HEAD : `rgb(${r},${g},${b})`;

    if (isHead) {
      ctx.shadowColor = COLOR_SNAKE_HEAD;
      ctx.shadowBlur = 15;
    } else {
      ctx.shadowBlur = 0;
    }

    // Rounded rect
    ctx.beginPath();
    ctx.moveTo(rx + radius, ry);
    ctx.lineTo(rx + rw - radius, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + radius, radius);
    ctx.lineTo(rx + rw, ry + rh - radius);
    ctx.arcTo(rx + rw, ry + rh, rx + rw - radius, ry + rh, radius);
    ctx.lineTo(rx + radius, ry + rh);
    ctx.arcTo(rx, ry + rh, rx, ry + rh - radius, radius);
    ctx.lineTo(rx, ry + radius);
    ctx.arcTo(rx, ry, rx + radius, ry, radius);
    ctx.closePath();
    ctx.fill();

    // Outline
    ctx.strokeStyle = isHead ? COLOR_SNAKE_HEAD : COLOR_SNAKE_OUTLINE;
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
  });

  // Border glow
  ctx.strokeStyle = COLOR_BORDER;
  ctx.lineWidth = 2;
  ctx.shadowColor = COLOR_BORDER;
  ctx.shadowBlur = 12;
  ctx.strokeRect(1, 1, size - 2, size - 2);
  ctx.shadowBlur = 0;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [gameState, setGameState] = useState<GameState>("start");
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>("RIGHT");
  const [nextDir, setNextDir] = useState<Direction>("RIGHT");
  const [score, setScore] = useState(0);
  const [localHighScore, setLocalHighScore] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [scoreFlash, setScoreFlash] = useState(false);
  const [canvasSize, setCanvasSize] = useState(400);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const snakeRef = useRef<Point[]>(snake);
  const dirRef = useRef<Direction>(direction);
  const nextDirRef = useRef<Direction>(nextDir);
  const foodRef = useRef<Point>(food);
  const scoreRef = useRef<number>(score);
  const gameStateRef = useRef<GameState>(gameState);
  const { data: topScores } = useTopScores();
  const { data: highScoreData } = useHighScore();
  const submitScoreMutation = useSubmitScore();

  // Sync refs
  useEffect(() => {
    snakeRef.current = snake;
  }, [snake]);
  useEffect(() => {
    dirRef.current = direction;
  }, [direction]);
  useEffect(() => {
    nextDirRef.current = nextDir;
  }, [nextDir]);
  useEffect(() => {
    foodRef.current = food;
  }, [food]);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Update local high score from backend
  useEffect(() => {
    if (highScoreData) {
      const hs = Number(highScoreData[0]);
      if (hs > localHighScore) setLocalHighScore(hs);
    }
  }, [highScoreData, localHighScore]);

  // Responsive canvas size
  useEffect(() => {
    const updateSize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const minDim = Math.min(vw - 32, vh - 200, 440);
      setCanvasSize(Math.max(280, minDim));
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameStateRef.current !== "playing") return;
      const opposite: Record<Direction, Direction> = {
        UP: "DOWN",
        DOWN: "UP",
        LEFT: "RIGHT",
        RIGHT: "LEFT",
      };
      let newDir: Direction | null = null;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") newDir = "UP";
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S")
        newDir = "DOWN";
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A")
        newDir = "LEFT";
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D")
        newDir = "RIGHT";

      if (newDir && newDir !== opposite[dirRef.current]) {
        e.preventDefault();
        setNextDir(newDir);
        nextDirRef.current = newDir;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // D-pad handler
  const handleDPad = useCallback((dir: Direction) => {
    if (gameStateRef.current !== "playing") return;
    const opposite: Record<Direction, Direction> = {
      UP: "DOWN",
      DOWN: "UP",
      LEFT: "RIGHT",
      RIGHT: "LEFT",
    };
    if (dir !== opposite[dirRef.current]) {
      setNextDir(dir);
      nextDirRef.current = dir;
    }
  }, []);

  // Draw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawBoard(ctx, snakeRef.current, foodRef.current, canvasSize);
  }, [canvasSize]);

  // Game tick
  const gameTick = useCallback(() => {
    const currentSnake = snakeRef.current;
    const currentDir = nextDirRef.current;

    // Apply direction
    setDirection(currentDir);
    dirRef.current = currentDir;

    const head = currentSnake[0];
    let newHead: Point;
    switch (currentDir) {
      case "UP":
        newHead = { x: head.x, y: head.y - 1 };
        break;
      case "DOWN":
        newHead = { x: head.x, y: head.y + 1 };
        break;
      case "LEFT":
        newHead = { x: head.x - 1, y: head.y };
        break;
      case "RIGHT":
        newHead = { x: head.x + 1, y: head.y };
        break;
    }

    // Wall collision
    if (
      newHead.x < 0 ||
      newHead.x >= GRID_COLS ||
      newHead.y < 0 ||
      newHead.y >= GRID_ROWS
    ) {
      setGameState("gameover");
      gameStateRef.current = "gameover";
      const finalScore = scoreRef.current;
      if (finalScore > localHighScore) setLocalHighScore(finalScore);
      return;
    }

    // Self collision (skip last segment since it will move)
    if (
      currentSnake
        .slice(0, -1)
        .some((s) => s.x === newHead.x && s.y === newHead.y)
    ) {
      setGameState("gameover");
      gameStateRef.current = "gameover";
      const finalScore = scoreRef.current;
      if (finalScore > localHighScore) setLocalHighScore(finalScore);
      return;
    }

    // Eat food
    const ate =
      newHead.x === foodRef.current.x && newHead.y === foodRef.current.y;
    const newSnake = ate
      ? [newHead, ...currentSnake]
      : [newHead, ...currentSnake.slice(0, -1)];

    if (ate) {
      const newScore = scoreRef.current + 10;
      scoreRef.current = newScore;
      setScore(newScore);
      setScoreFlash(true);
      setTimeout(() => setScoreFlash(false), 300);
      const newFood = randomPoint(newSnake);
      foodRef.current = newFood;
      setFood(newFood);
    }

    snakeRef.current = newSnake;
    setSnake(newSnake);
  }, [localHighScore]);

  // Game loop
  useEffect(() => {
    if (gameState !== "playing") {
      cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const loop = (timestamp: number) => {
      if (gameStateRef.current !== "playing") return;
      const speed = getSpeed(scoreRef.current);
      if (timestamp - lastTickRef.current >= speed) {
        lastTickRef.current = timestamp;
        gameTick();
      }
      drawCanvas();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [gameState, gameTick, drawCanvas]);

  // Draw static canvas on start/gameover
  useEffect(() => {
    if (gameState !== "playing") {
      drawCanvas();
    }
  }, [gameState, drawCanvas]);

  const startGame = useCallback(() => {
    const initSnake = [{ x: 10, y: 10 }];
    const initFood = randomPoint(initSnake);
    setSnake(initSnake);
    snakeRef.current = initSnake;
    setFood(initFood);
    foodRef.current = initFood;
    setDirection("RIGHT");
    dirRef.current = "RIGHT";
    setNextDir("RIGHT");
    nextDirRef.current = "RIGHT";
    setScore(0);
    scoreRef.current = 0;
    setSubmitted(false);
    lastTickRef.current = 0;
    setGameState("playing");
    gameStateRef.current = "playing";
  }, []);

  const handleSubmitScore = useCallback(async () => {
    if (!playerName.trim()) {
      toast.error("कृपया अपना नाम दर्ज करें");
      return;
    }
    try {
      await submitScoreMutation.mutateAsync({ name: playerName.trim(), score });
      setSubmitted(true);
      toast.success("स्कोर सबमिट हो गया! 🎉");
    } catch {
      toast.error("स्कोर सबमिट करने में त्रुटि");
    }
  }, [playerName, score, submitScoreMutation]);

  const globalHighScore = highScoreData ? Number(highScoreData[0]) : 0;
  const globalHighScoreName = highScoreData ? highScoreData[1] : "";
  const displayHighScore = Math.max(localHighScore, globalHighScore);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start"
      style={{ background: "oklch(0.08 0.01 260)" }}
    >
      <Toaster />

      {/* Header */}
      <header
        className="w-full py-3 px-4 flex items-center justify-center border-b"
        style={{ borderColor: "oklch(0.25 0.04 260)" }}
      >
        <h1
          className="game-title text-2xl md:text-3xl animate-neon-flicker"
          style={{ color: "oklch(0.82 0.25 145)" }}
        >
          <span className="neon-glow-green">KATUMBALA</span>
          <span
            className="ml-2 text-lg"
            style={{ color: "oklch(0.72 0.28 335)" }}
          >
            🐍
          </span>
        </h1>
      </header>

      <main className="flex-1 w-full max-w-lg px-4 py-4 flex flex-col items-center">
        {/* ── START SCREEN ── */}
        <AnimatePresence mode="wait">
          {gameState === "start" && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full flex flex-col items-center"
            >
              {/* Decorative snake preview */}
              <div
                className="relative w-full rounded-lg overflow-hidden mb-4"
                style={{
                  border: "1px solid oklch(0.82 0.25 145 / 0.3)",
                  background: "oklch(0.1 0.015 260)",
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={canvasSize}
                  height={canvasSize}
                  className="w-full block"
                  data-ocid="game.canvas_target"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>

              {/* Tagline */}
              <p
                className="text-center text-sm mb-1 px-4"
                style={{
                  color: "oklch(0.72 0.28 335)",
                  fontFamily: "Cabinet Grotesk, sans-serif",
                }}
              >
                तीर के बटन से साँप को चलाओ, खाना खाओ और बढ़ो!
              </p>
              <p
                className="mono-font text-center text-xs mb-4 px-4"
                style={{ color: "oklch(0.45 0.04 260)" }}
              >
                Arrow keys / WASD to control
              </p>

              {/* Start button */}
              <Button
                size="lg"
                onClick={startGame}
                data-ocid="game.primary_button"
                className="w-full max-w-xs text-lg font-bold py-6 relative overflow-hidden"
                style={{
                  background: "oklch(0.82 0.25 145)",
                  color: "oklch(0.08 0.01 260)",
                  border: "none",
                  fontFamily: "Cabinet Grotesk, sans-serif",
                  fontSize: "1.1rem",
                  letterSpacing: "0.05em",
                }}
              >
                <span className="relative z-10">▶ खेलना शुरू करें</span>
              </Button>

              {/* Leaderboard on start screen */}
              <Leaderboard />
            </motion.div>
          )}

          {/* ── PLAYING SCREEN ── */}
          {gameState === "playing" && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full flex flex-col items-center"
            >
              {/* Score bar */}
              <div className="w-full flex justify-between items-center mb-3 px-1">
                <div>
                  <span
                    className="mono-font text-xs uppercase tracking-widest"
                    style={{ color: "oklch(0.45 0.04 260)" }}
                  >
                    स्कोर
                  </span>
                  <div
                    className={`mono-font text-3xl font-bold neon-glow-green ${scoreFlash ? "score-flash" : ""}`}
                    style={{ color: "oklch(0.82 0.25 145)" }}
                  >
                    {score}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className="mono-font text-xs uppercase tracking-widest"
                    style={{ color: "oklch(0.45 0.04 260)" }}
                  >
                    हाई स्कोर
                  </span>
                  <div
                    className="mono-font text-xl font-bold"
                    style={{ color: "oklch(0.72 0.28 335)" }}
                  >
                    {displayHighScore}
                  </div>
                </div>
              </div>

              {/* Canvas */}
              <div
                className="relative rounded-lg overflow-hidden neon-border-green"
                style={{ border: "2px solid oklch(0.82 0.25 145 / 0.5)" }}
              >
                <canvas
                  ref={canvasRef}
                  width={canvasSize}
                  height={canvasSize}
                  className="block"
                  data-ocid="game.canvas_target"
                  style={{ imageRendering: "pixelated", display: "block" }}
                />
              </div>

              {/* D-pad for mobile */}
              <DPad onDirection={handleDPad} />

              {/* Speed indicator */}
              <p
                className="mono-font text-xs mt-3"
                style={{ color: "oklch(0.35 0.04 260)" }}
              >
                Level {Math.floor(score / 50) + 1} • Speed{" "}
                {Math.round(1000 / getSpeed(score))}fps
              </p>
            </motion.div>
          )}

          {/* ── GAME OVER SCREEN ── */}
          {gameState === "gameover" && (
            <motion.div
              key="gameover"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
              className="w-full flex flex-col items-center"
            >
              {/* Canvas (frozen) */}
              <div
                className="relative rounded-lg overflow-hidden mb-4 w-full"
                style={{
                  border: "2px solid oklch(0.65 0.25 25 / 0.6)",
                  boxShadow: "0 0 20px oklch(0.65 0.25 25 / 0.3)",
                  opacity: 0.6,
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={canvasSize}
                  height={canvasSize}
                  className="w-full block"
                  data-ocid="game.canvas_target"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>

              {/* Game over card */}
              <motion.div
                className="w-full rounded-xl p-6 text-center"
                style={{
                  background: "oklch(0.12 0.015 260)",
                  border: "1px solid oklch(0.65 0.25 25 / 0.5)",
                  boxShadow: "0 0 30px oklch(0.65 0.25 25 / 0.2)",
                }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <h2
                  className="game-title text-4xl mb-1 neon-glow-pink"
                  style={{ color: "oklch(0.72 0.28 335)" }}
                >
                  गेम ओवर!
                </h2>
                <p
                  className="mono-font text-xs mb-4"
                  style={{ color: "oklch(0.45 0.04 260)" }}
                >
                  GAME OVER
                </p>

                <div className="flex justify-center gap-8 mb-4">
                  <div>
                    <p
                      className="mono-font text-xs uppercase tracking-widest"
                      style={{ color: "oklch(0.45 0.04 260)" }}
                    >
                      आपका स्कोर
                    </p>
                    <p
                      className="mono-font text-4xl font-black neon-glow-green"
                      style={{ color: "oklch(0.82 0.25 145)" }}
                    >
                      {score}
                    </p>
                  </div>
                  <div>
                    <p
                      className="mono-font text-xs uppercase tracking-widest"
                      style={{ color: "oklch(0.45 0.04 260)" }}
                    >
                      हाई स्कोर
                    </p>
                    <p
                      className="mono-font text-4xl font-black"
                      style={{
                        color:
                          score >= displayHighScore
                            ? "oklch(0.88 0.22 90)"
                            : "oklch(0.72 0.28 335)",
                      }}
                    >
                      {Math.max(score, displayHighScore)}
                    </p>
                  </div>
                </div>

                {score > 0 &&
                  globalHighScoreName &&
                  score < globalHighScore && (
                    <p
                      className="mono-font text-xs mb-3"
                      style={{ color: "oklch(0.55 0.04 260)" }}
                    >
                      🏆 रिकॉर्ड: {globalHighScoreName} — {globalHighScore}
                    </p>
                  )}

                {/* Submit score */}
                {!submitted ? (
                  <div className="flex gap-2 mb-4">
                    <Input
                      placeholder="अपना नाम लिखें..."
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleSubmitScore()
                      }
                      maxLength={20}
                      data-ocid="game.input"
                      className="flex-1 mono-font"
                      style={{
                        background: "oklch(0.15 0.02 260)",
                        border: "1px solid oklch(0.35 0.04 260)",
                        color: "oklch(0.9 0.05 145)",
                        fontFamily: "Geist Mono, monospace",
                      }}
                    />
                    <Button
                      onClick={handleSubmitScore}
                      disabled={submitScoreMutation.isPending}
                      data-ocid="game.submit_button"
                      style={{
                        background: "oklch(0.72 0.28 335)",
                        color: "oklch(0.08 0.01 260)",
                        border: "none",
                        fontFamily: "Cabinet Grotesk, sans-serif",
                        fontWeight: 700,
                      }}
                    >
                      {submitScoreMutation.isPending ? "..." : "सबमिट"}
                    </Button>
                  </div>
                ) : (
                  <motion.p
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mono-font text-sm mb-4"
                    style={{ color: "oklch(0.82 0.25 145)" }}
                  >
                    ✓ स्कोर सहेजा गया! • Score saved!
                  </motion.p>
                )}

                {/* Play again */}
                <Button
                  size="lg"
                  onClick={startGame}
                  data-ocid="game.secondary_button"
                  className="w-full text-lg font-bold py-5"
                  style={{
                    background: "oklch(0.18 0.02 260)",
                    color: "oklch(0.82 0.25 145)",
                    border: "1px solid oklch(0.82 0.25 145 / 0.5)",
                    fontFamily: "Cabinet Grotesk, sans-serif",
                    fontSize: "1rem",
                    letterSpacing: "0.05em",
                  }}
                >
                  🔄 फिर खेलें
                </Button>

                {/* Mini leaderboard on game over */}
                {topScores && topScores.length > 0 && (
                  <div className="mt-4">
                    <h3
                      className="mono-font text-xs tracking-widest uppercase mb-2"
                      style={{ color: "oklch(0.72 0.28 335)" }}
                    >
                      🏆 शीर्ष खिलाड़ी
                    </h3>
                    <div className="space-y-1">
                      {topScores.slice(0, 5).map((entry, i) => {
                        const ocidMap: Record<number, string> = {
                          0: "leaderboard.item.1",
                          1: "leaderboard.item.2",
                          2: "leaderboard.item.3",
                          3: "leaderboard.item.4",
                          4: "leaderboard.item.5",
                        };
                        return (
                          <div
                            key={`go-lb-${i}-${entry.name}`}
                            data-ocid={ocidMap[i]}
                            className="leaderboard-row flex items-center justify-between px-3 py-1 rounded text-xs"
                            style={{ border: "1px solid oklch(0.2 0.03 260)" }}
                          >
                            <span
                              className="mono-font font-bold w-5"
                              style={{
                                color:
                                  i === 0
                                    ? "oklch(0.88 0.22 90)"
                                    : "oklch(0.45 0.04 260)",
                              }}
                            >
                              {i + 1}
                            </span>
                            <span
                              className="mono-font flex-1 px-2 truncate"
                              style={{ color: "oklch(0.7 0.05 260)" }}
                            >
                              {entry.name || "Anonymous"}
                            </span>
                            <span
                              className="mono-font font-bold"
                              style={{ color: "oklch(0.82 0.25 145)" }}
                            >
                              {Number(entry.score)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer
        className="w-full py-3 text-center border-t"
        style={{ borderColor: "oklch(0.18 0.02 260)" }}
      >
        <p
          className="mono-font text-xs"
          style={{ color: "oklch(0.35 0.04 260)" }}
        >
          © {new Date().getFullYear()}. Built with ♥ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "oklch(0.82 0.25 145)" }}
          >
            caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}
