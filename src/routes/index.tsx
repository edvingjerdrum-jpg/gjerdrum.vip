import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import FishGame from "@/game/Game";
import Menu, { type Choice } from "@/game/Menu";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Fisk Strike – et tullete fiskeskytespill" },
      { name: "description", content: "Et tullete Counter-Strike-aktig skytespill der våpnene er fisk. Spill mot boter eller venner." },
      { property: "og:title", content: "Fisk Strike" },
      { property: "og:description", content: "Skyt fisk på kloner i en ørkenarena – alene eller med venner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function setRoomInUrl(room: string | null) {
  const url = new URL(window.location.href);
  if (room) url.searchParams.set("room", room);
  else url.searchParams.delete("room");
  window.history.replaceState(null, "", url);
}

function Index() {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [initialRoom, setInitialRoom] = useState<string | null>(null);

  useEffect(() => {
    setInitialRoom(new URL(window.location.href).searchParams.get("room")?.toUpperCase() ?? null);
  }, []);

  if (!choice) {
    return <Menu key={initialRoom ?? ""} initialRoom={initialRoom} onStart={(c) => { setRoomInUrl(c.room); setChoice(c); }} />;
  }
  return (
    <FishGame
      key={`${choice.mode}-${choice.room}`}
      {...choice}
      onExit={() => { setRoomInUrl(null); setInitialRoom(null); setChoice(null); }}
    />
  );
}
