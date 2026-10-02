"use client";

import { useCallback, useEffect, useRef } from "react";

interface OrderStatusSnapshot {
  id: string;
  status: string;
}

interface SoundEnabledRef {
  current: boolean;
}

/** Plays one follow-up ring 10 seconds after new pending orders arrive. */
export function usePendingOrderReminder(
  soundEnabledRef: SoundEnabledRef,
  playRing: () => void
) {
  const timeoutRef = useRef<number | null>(null);
  const pendingOrderIdsRef = useRef(new Set<string>());
  const statusByOrderIdRef = useRef(new Map<string, string>());
  const playRingRef = useRef(playRing);

  useEffect(() => {
    playRingRef.current = playRing;
  }, [playRing]);

  const cancelAll = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingOrderIdsRef.current.clear();
  }, []);

  const syncOrderStatuses = useCallback(
    (orders: OrderStatusSnapshot[]) => {
      statusByOrderIdRef.current = new Map(
        orders.map((order): [string, string] => [order.id, order.status])
      );

      for (const orderId of pendingOrderIdsRef.current) {
        if (statusByOrderIdRef.current.get(orderId) !== "pending") {
          pendingOrderIdsRef.current.delete(orderId);
        }
      }

      if (pendingOrderIdsRef.current.size === 0) cancelAll();
    },
    [cancelAll]
  );

  const scheduleFor = useCallback(
    (orders: OrderStatusSnapshot[]) => {
      if (!soundEnabledRef.current) return;

      orders.forEach((order) => {
        if (order.status === "pending") pendingOrderIdsRef.current.add(order.id);
      });
      if (pendingOrderIdsRef.current.size === 0) return;

      // Keep the first arrival's deadline when orders come in as a burst.
      if (timeoutRef.current !== null) return;
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        const stillPending = Array.from(pendingOrderIdsRef.current).some(
          (orderId) => statusByOrderIdRef.current.get(orderId) === "pending"
        );
        pendingOrderIdsRef.current.clear();
        if (stillPending && soundEnabledRef.current) playRingRef.current();
      }, 10_000);
    },
    [soundEnabledRef]
  );

  useEffect(() => cancelAll, [cancelAll]);

  return { scheduleFor, syncOrderStatuses, cancelAll };
}
