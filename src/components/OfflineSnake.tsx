"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Point = { x: number; y: number };
type Direction = Point;

const BOARD_SIZE = 18;
const START_SNAKE: Point[] = [
  { x: 7, y: 9 },
  { x: 6, y: 9 },
  { x: 5, y: 9 },
];
const START_DIRECTION: Direction = { x: 1, y: 0 };

const PRIVATE_ROUTES = [
  "/admin",
  "/kitchen",
  "/counter",
  "/delivery",
  "/developer",
  "/staff-attendance",
];

function isPrivateRoute(pathname: string | null): boolean {
  return Boolean(
    pathname &&
      PRIVATE_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(route + "/")
      )
  );
}

function randomFood(snake: Point[]): Point {
  let food: Point;
  do {
    food = {
      x: Math.floor(Math.random() * BOARD_SIZE),
      y: Math.floor(Math.random() * BOARD_SIZE),
    };
  } while (snake.some((segment) => segment.x === food.x && segment.y === food.y));
  return food;
}

export default function OfflineSnake() {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);
  const [snake, setSnake] = useState<Point[]>(() =>
    START_SNAKE.map((segment) => ({ ...segment }))
  );
  const [food, setFood] = useState<Point>(() => randomFood(START_SNAKE));
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const directionRef = useRef<Direction>(START_DIRECTION);
  const queuedDirectionRef = useRef<Direction>(START_DIRECTION);

  const queueDirection = useCallback((next: Direction) => {
    const current = queuedDirectionRef.current;
    if (next.x + current.x === 0 && next.y + current.y === 0) return;
    queuedDirectionRef.current = next;
  }, []);

  const restartGame = useCallback(() => {
    const nextSnake = START_SNAKE.map((segment) => ({ ...segment }));
    const nextFood = randomFood(nextSnake);
    snakeRef.current = nextSnake;
    foodRef.current = nextFood;
    directionRef.current = START_DIRECTION;
    queuedDirectionRef.current = START_DIRECTION;
    setSnake(nextSnake);
    setFood(nextFood);
    setScore(0);
    setIsPaused(false);
    setIsGameOver(false);
  }, []);

  useEffect(() => {
    const syncConnection = () => setIsOnline(navigator.onLine);
    syncConnection();
    window.addEventListener("online", syncConnection);
    window.addEventListener("offline", syncConnection);

    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      void navigator.serviceWorker
        .register("/sw.js")
        .catch((error: unknown) =>
          console.warn("Offline page could not be prepared:", error)
        );
    }

    return () => {
      window.removeEventListener("online", syncConnection);
      window.removeEventListener("offline", syncConnection);
    };
  }, []);

  const isVisible = !isOnline && !isPrivateRoute(pathname);

  useEffect(() => {
    if (!isVisible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || isPaused || isGameOver) return;

    const timer = window.setInterval(() => {
      const direction = queuedDirectionRef.current;
      directionRef.current = direction;
      const currentSnake = snakeRef.current;
      const currentHead = currentSnake[0];
      const nextHead = {
        x: currentHead.x + direction.x,
        y: currentHead.y + direction.y,
      };
      const eatsFood =
        nextHead.x === foodRef.current.x && nextHead.y === foodRef.current.y;
      const collisionBody = eatsFood
        ? currentSnake
        : currentSnake.slice(0, -1);
      const hitWall =
        nextHead.x < 0 ||
        nextHead.y < 0 ||
        nextHead.x >= BOARD_SIZE ||
        nextHead.y >= BOARD_SIZE;
      const hitSnake = collisionBody.some(
        (segment) => segment.x === nextHead.x && segment.y === nextHead.y
      );

      if (hitWall || hitSnake) {
        setIsGameOver(true);
        return;
      }

      const nextSnake = [nextHead, ...currentSnake];
      if (!eatsFood) nextSnake.pop();
      snakeRef.current = nextSnake;
      setSnake(nextSnake);

      if (eatsFood) {
        setScore((current) => current + 10);
        if (nextSnake.length === BOARD_SIZE * BOARD_SIZE) {
          setIsGameOver(true);
          return;
        }
        const nextFood = randomFood(nextSnake);
        foodRef.current = nextFood;
        setFood(nextFood);
      }
    }, 145);

    return () => window.clearInterval(timer);
  }, [isVisible, isPaused, isGameOver]);

  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const directions: Record<string, Direction> = {
        arrowup: { x: 0, y: -1 },
        w: { x: 0, y: -1 },
        arrowdown: { x: 0, y: 1 },
        s: { x: 0, y: 1 },
        arrowleft: { x: -1, y: 0 },
        a: { x: -1, y: 0 },
        arrowright: { x: 1, y: 0 },
        d: { x: 1, y: 0 },
      };

      if (directions[key]) {
        event.preventDefault();
        queueDirection(directions[key]);
      } else if (key === " " || key === "p") {
        event.preventDefault();
        if (!isGameOver) setIsPaused((current) => !current);
      } else if (key === "r" && isGameOver) {
        restartGame();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, isGameOver, queueDirection, restartGame]);

  if (!isVisible) return null;

  const snakePositions = new Map(
    snake.map((segment, index) => [
      segment.x + segment.y * BOARD_SIZE,
      index,
    ] as const)
  );
  const foodIndex = food.x + food.y * BOARD_SIZE;
  const controlButton =
    "grid h-12 w-12 touch-manipulation place-items-center rounded-2xl border border-white/10 bg-white/10 text-2xl font-black text-white transition active:scale-95 active:bg-orange-500/50 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300";

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-snake-title"
      className="fixed inset-0 z-[10000] overflow-y-auto bg-[#160e0a] text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_18%_12%,rgba(249,115,22,0.2),transparent_35%),radial-gradient(ellipse_at_86%_84%,rgba(234,88,12,0.13),transparent_34%)]"
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center px-4 py-7 sm:px-6">
        <header className="mb-5 text-center">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-orange-200">
            <span className="motion-safe:animate-pulse h-2 w-2 rounded-full bg-orange-400" />
            You&apos;re offline
          </p>
          <h1
            id="offline-snake-title"
            className="mt-4 text-3xl font-black tracking-tight sm:text-4xl"
          >
            No internet. <span className="text-orange-400">No boredom.</span>
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-orange-50/65">
            Play a quick round while we wait for your connection to come back.
            Your page will return automatically.
          </p>
        </header>

        <div className="mx-auto grid w-full max-w-3xl gap-5 rounded-[2rem] border border-white/10 bg-white/[0.045] p-3 shadow-[0_30px_100px_rgba(0,0,0,0.38)] backdrop-blur sm:p-5 md:grid-cols-[minmax(0,1fr)_230px]">
          <div className="mx-auto w-full max-w-[440px]">
            <div className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-orange-50/65">
              <span>Use arrow keys or WASD</span>
              <span aria-live="polite">Score {score}</span>
            </div>
            <div
              role="img"
              aria-label={"Snake game board, score " + score}
              className="grid aspect-square w-full gap-[3px] rounded-2xl border border-orange-200/10 bg-[#281912] p-2.5 shadow-inner"
              style={{
                gridTemplateColumns: "repeat(" + BOARD_SIZE + ", minmax(0, 1fr))",
              }}
            >
              {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
                const segmentIndex = snakePositions.get(index);
                const isFood = index === foodIndex;
                let cellClass =
                  "rounded-[3px] bg-white/[0.035] transition-colors";
                if (segmentIndex === 0) {
                  cellClass =
                    "rounded-[4px] bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.65)]";
                } else if (segmentIndex !== undefined) {
                  cellClass = "rounded-[3px] bg-orange-300";
                } else if (isFood) {
                  cellClass =
                    "rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.7)]";
                }
                return <div key={index} aria-hidden="true" className={cellClass} />;
              })}
            </div>
            <p className="mt-2 text-center text-[11px] font-semibold text-orange-50/50 md:hidden">
              Use the arrows to steer
            </p>
          </div>

          <aside className="flex flex-col items-center justify-between gap-4 py-1 text-center md:items-stretch md:text-left">
            <div>
              <div className="flex items-center justify-center gap-2 md:justify-between">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-orange-200/75">
                  Best bite
                </span>
                <span className="rounded-full bg-orange-400/10 px-3 py-1 text-sm font-black tabular-nums text-orange-200">
                  {score} pts
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                Eat the golden dots, grow your snake, and keep clear of the walls.
              </p>
              {isGameOver && (
                <p role="status" className="mt-3 text-sm font-black text-orange-300">
                  Round over · final score {score}
                </p>
              )}
              {isPaused && !isGameOver && (
                <p role="status" className="mt-3 text-sm font-black text-orange-300">
                  Game paused
                </p>
              )}
            </div>

            <div className="flex flex-col items-center gap-3">
              <div
                role="group"
                aria-label="Touch controls"
                className="grid grid-cols-3 gap-2"
              >
                <span />
                <button
                  type="button"
                  className={controlButton}
                  aria-label="Move up"
                  onClick={() => queueDirection({ x: 0, y: -1 })}
                >
                  ↑
                </button>
                <span />
                <button
                  type="button"
                  className={controlButton}
                  aria-label="Move left"
                  onClick={() => queueDirection({ x: -1, y: 0 })}
                >
                  ←
                </button>
                <button
                  type="button"
                  className={controlButton}
                  aria-label="Move down"
                  onClick={() => queueDirection({ x: 0, y: 1 })}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={controlButton}
                  aria-label="Move right"
                  onClick={() => queueDirection({ x: 1, y: 0 })}
                >
                  →
                </button>
              </div>

              <div className="flex w-full gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaused((current) => !current)}
                  disabled={isGameOver}
                  className="flex-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-xs font-black transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isPaused ? "Resume" : "Pause"}
                </button>
                {isGameOver && (
                  <button
                    type="button"
                    onClick={restartGame}
                    className="flex-1 rounded-xl bg-orange-500 px-3 py-2.5 text-xs font-black text-white transition hover:bg-orange-400"
                  >
                    Play again
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] font-semibold text-white/35">
              Space or P pauses · R restarts after a round
            </p>
          </aside>
        </div>

        <p className="mt-5 text-center text-[11px] font-semibold text-white/40">
          Back online? This screen will close on its own.
        </p>
      </div>
    </section>
  );
}
