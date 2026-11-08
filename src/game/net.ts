import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { WeaponId } from "./sim";

export const playerId = typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random());
export const MAX_ROOM = 8;

export type NetState = { id: string; name: string; x: number; y?: number; z: number; ry: number; w: WeaponId; dead: boolean; k: number; d: number };
export type NetShot = { id: string; x: number; y: number; z: number; dx: number; dy: number; dz: number; kind: WeaponId };
export type NetHit = { from: string; target: string; dmg: number; kind: WeaponId };
export type NetKill = { killer: string; victim: string; kind: WeaponId };

export type Handlers = {
  onState: (s: NetState) => void;
  onShot: (s: NetShot) => void;
  onHit: (h: NetHit) => void;
  onKill: (k: NetKill) => void;
  onRoster: (r: { id: string; name: string }[]) => void;
};

/** Net tick sized to the room so N² × tick stays under ~250 msg/s. */
export function netTick(players: number) {
  const hz = players <= 5 ? 8 : players <= 6 ? 6 : 4;
  return 1 / hz;
}

export function randomRoom() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function useGameChannel(room: string | null, name: string, handlers: Handlers) {
  const ref = useRef<RealtimeChannel | null>(null);
  const h = useRef(handlers);
  h.current = handlers;

  useEffect(() => {
    if (!room) return;
    const channel = supabase.channel(`fisk:${room}`, {
      config: { broadcast: { self: false }, presence: { key: playerId } },
    });
    channel
      .on("broadcast", { event: "state" }, ({ payload }) => h.current.onState(payload as NetState))
      .on("broadcast", { event: "shot" }, ({ payload }) => h.current.onShot(payload as NetShot))
      .on("broadcast", { event: "hit" }, ({ payload }) => h.current.onHit(payload as NetHit))
      .on("broadcast", { event: "kill" }, ({ payload }) => h.current.onKill(payload as NetKill))
      .on("presence", { event: "sync" }, () => {
        const roster = Object.entries(channel.presenceState<{ name: string }>()).map(([id, metas]) => ({
          id,
          name: metas[0]?.name ?? "Spelare",
        }));
        h.current.onRoster(roster);
      })
      .subscribe((status) => {
        console.log("[net] channel:", status);
        if (status === "SUBSCRIBED") channel.track({ name });
      });
    ref.current = channel;
    return () => {
      ref.current = null;
      supabase.removeChannel(channel);
    };
    // name is fixed for the session; only the room may re-run this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  return ref;
}
