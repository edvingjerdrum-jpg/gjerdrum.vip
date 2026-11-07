import { useState } from "react";
import { randomRoom } from "./net";

export type Choice = { mode: "solo" | "online"; name: string; room: string | null };

export default function Menu({ initialRoom, onStart }: { initialRoom: string | null; onStart: (c: Choice) => void }) {
  const [name, setName] = useState(() => (typeof localStorage !== "undefined" && localStorage.getItem("fisk-name")) || "");
  const [code, setCode] = useState(initialRoom ?? "");
  const n = name.trim().slice(0, 16) || "Fiskare";
  const go = (c: Choice) => { localStorage.setItem("fisk-name", n); onStart(c); };

  return (
    <div className="flex min-h-screen items-center justify-center bg-menu p-4 font-mono text-hud">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-hud-panel-strong p-8 text-center">
        <div>
          <h1 className="text-5xl font-bold tracking-tight">FISK STRIKE</h1>
          <p className="mt-2 text-sm opacity-80">Counter-Strike, fast med fiskar 🐟</p>
        </div>
        <input
          className="w-full rounded border border-hud bg-transparent px-3 py-2 text-center outline-none focus:border-hud-accent"
          placeholder="Ditt namn"
          maxLength={16}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="w-full rounded bg-hud-accent px-6 py-3 text-lg font-bold text-hud-ink hover:opacity-90"
          onClick={() => go({ mode: "solo", name: n, room: null })}>
          Spela mot bottar
        </button>
        <div className="space-y-2 border-t border-hud pt-6">
          <p className="text-sm opacity-80">Multiplayer (upp till 8 spelare)</p>
          <button className="w-full rounded border border-hud px-6 py-2 hover:bg-hud-panel"
            onClick={() => go({ mode: "online", name: n, room: randomRoom() })}>
            Skapa nytt rum
          </button>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded border border-hud bg-transparent px-3 py-2 text-center uppercase outline-none focus:border-hud-accent"
              placeholder="Rumkod"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            />
            <button className="rounded border border-hud px-4 py-2 hover:bg-hud-panel disabled:opacity-40" disabled={code.length < 3}
              onClick={() => go({ mode: "online", name: n, room: code })}>
              Gå med
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
