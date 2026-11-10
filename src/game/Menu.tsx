import { useState } from "react";
import { Button } from "@/components/ui/button";
import { randomRoom } from "./net";

export type Choice = { mode: "solo" | "online"; name: string; room: string | null };

export default function Menu({ initialRoom, onStart }: { initialRoom: string | null; onStart: (c: Choice) => void }) {
  const [name, setName] = useState(() => (typeof localStorage !== "undefined" && localStorage.getItem("fisk-name")) || "");
  const [code, setCode] = useState(initialRoom ?? "");
  const n = name.trim().slice(0, 16) || "Fisker";
  const go = (c: Choice) => { localStorage.setItem("fisk-name", n); onStart(c); };

  return (
    <div className="flex min-h-screen items-center justify-center bg-menu p-4 font-mono text-hud">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-hud-panel-strong p-8 text-center">
        <div>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Norge Simulator 2026</h1>
        </div>
        <input
          className="w-full rounded border border-hud bg-transparent px-3 py-2 text-center outline-none focus:border-hud-accent"
          placeholder="Ditt navn"
          maxLength={16}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button className="h-auto w-full rounded bg-hud-accent px-6 py-3 text-lg font-bold text-hud-ink hover:bg-hud-accent hover:opacity-90"
          onClick={() => go({ mode: "solo", name: n, room: null })}>
          Spill mot boter
        </Button>
        <div className="space-y-2 border-t border-hud pt-6">
          <p className="text-sm opacity-80">Flerspiller (opptil 8 spillere)</p>
          <Button variant="ghost" className="h-auto w-full rounded border border-hud px-6 py-2 hover:bg-hud-panel hover:text-hud"
            onClick={() => go({ mode: "online", name: n, room: randomRoom() })}>
            Lag nytt rom
          </Button>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded border border-hud bg-transparent px-3 py-2 text-center uppercase outline-none focus:border-hud-accent"
              placeholder="Romkode"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            />
            <Button variant="ghost" className="h-auto rounded border border-hud px-4 py-2 hover:bg-hud-panel hover:text-hud disabled:opacity-40" disabled={code.length < 3}
              onClick={() => go({ mode: "online", name: n, room: code })}>
              Bli med
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
