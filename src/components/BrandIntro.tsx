"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

const SESSION_KEY = "elpresto:brand-intro:v1";
const INTRO_DURATION_MS = 1650;

let playedWithoutSessionStorage = false;
let visibleSnapshot = true;
const introListeners = new Set<() => void>();

function subscribeToIntro(callback: () => void) {
  introListeners.add(callback);
  return () => {
    introListeners.delete(callback);
  };
}

function getIntroSnapshot() {
  return visibleSnapshot;
}

function getServerIntroSnapshot() {
  return true;
}

function setIntroVisible(nextVisible: boolean) {
  if (visibleSnapshot === nextVisible) return;
  visibleSnapshot = nextVisible;
  introListeners.forEach((callback) => callback());
}

export default function BrandIntro() {
  const visible = useSyncExternalStore(
    subscribeToIntro,
    getIntroSnapshot,
    getServerIntroSnapshot
  );
  const [logoLoaded, setLogoLoaded] = useState(false);
  const logoRef = useRef<HTMLImageElement>(null);
  const startedByThisMount = useRef(false);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const isHome = window.location.pathname === "/";
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const bootstrappedForPlayback =
      root.getAttribute("data-ep-intro") === "play";

    let sessionValue: string | null = null;
    try {
      sessionValue = window.sessionStorage.getItem(SESSION_KEY);
    } catch {
      // Private browsing modes can deny sessionStorage; this page load can
      // still play once, with the module flag preventing SPA replays.
    }

    const strictModeEffectReplay =
      startedByThisMount.current &&
      (sessionValue === "playing" || !sessionValue);
    const shouldPlay =
      isHome &&
      !prefersReducedMotion &&
      (bootstrappedForPlayback ||
        (!sessionValue && !playedWithoutSessionStorage) ||
        strictModeEffectReplay);

    if (!shouldPlay) {
      root.setAttribute("data-ep-intro", "skip");
      setIntroVisible(false);
      return;
    }

    startedByThisMount.current = true;
    playedWithoutSessionStorage = true;
    try {
      window.sessionStorage.setItem(SESSION_KEY, "playing");
    } catch {
      // The intro still has a bounded CSS lifetime if storage is unavailable.
    }

    root.setAttribute("data-ep-intro", "play");
    setIntroVisible(true);
    const overlay = document.querySelector<HTMLElement>(".ep-presto-intro");
    const fadeAnimation = overlay
      ?.getAnimations()
      .find(
        (animation) =>
          "animationName" in animation &&
          animation.animationName === "ep-presto-intro-fade"
      );
    const animationEnd = fadeAnimation?.effect?.getComputedTiming().endTime;
    const animationTime = fadeAnimation?.currentTime;
    const computedOverlay = overlay ? window.getComputedStyle(overlay) : null;
    const alreadyFaded =
      computedOverlay?.visibility === "hidden" ||
      Number(computedOverlay?.opacity ?? 1) === 0;
    const remaining = alreadyFaded
      ? 0
      : typeof animationEnd === "number" && typeof animationTime === "number"
        ? Math.max(0, animationEnd - animationTime)
        : INTRO_DURATION_MS;

    if (remaining === 0) {
      root.setAttribute("data-ep-intro", "skip");
      try {
        window.sessionStorage.setItem(SESSION_KEY, "done");
      } catch {
        // No persistent state is available in this browser context.
      }
      setIntroVisible(false);
      return;
    }

    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const restoreScroll = () => {
      if (root.style.overflow === "hidden") {
        root.style.overflow = previousRootOverflow;
      }
      if (document.body.style.overflow === "hidden") {
        document.body.style.overflow = previousBodyOverflow;
      }
    };

    const finish = () => {
      root.setAttribute("data-ep-intro", "skip");
      try {
        window.sessionStorage.setItem(SESSION_KEY, "done");
      } catch {
        // The intro has still completed for this document.
      }
      restoreScroll();
      setIntroVisible(false);
    };

    const timer = window.setTimeout(finish, remaining);

    return () => {
      window.clearTimeout(timer);
      restoreScroll();
      if (root.getAttribute("data-ep-intro") === "play") {
        // Preserve the once-per-session guard if navigation interrupts the
        // intro. A Strict Mode effect replay on this same mount can resume it.
        root.setAttribute("data-ep-intro", "skip");
      }
    };
  }, []);

  useLayoutEffect(() => {
    const image = logoRef.current;
    if (image?.complete) setLogoLoaded(image.naturalWidth > 0);
  }, []);

  if (!visible) return null;

  return (
    <div className="ep-presto-intro" aria-hidden="true">
      <div className="ep-presto-intro__glow" />
      <div className="ep-presto-intro__logo">
        <span
          className={`ep-presto-intro__fallback${logoLoaded ? " is-hidden" : ""}`}
        >
          EL PRESTO
        </span>
        <Image
          ref={logoRef}
          src="/logo.png"
          alt=""
          width={460}
          height={300}
          sizes="(max-width: 560px) 82vw, 460px"
          preload
          unoptimized
          onLoad={() => setLogoLoaded(true)}
          onError={() => setLogoLoaded(false)}
          className={`ep-presto-intro__image${logoLoaded ? " is-loaded" : ""}`}
        />
      </div>
    </div>
  );
}
