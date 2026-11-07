import { createFileRoute } from "@tanstack/react-router";
import FishGame from "@/game/Game";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Fisk Strike – fånigt fiskskjutspel" },
      { name: "description", content: "Ett fånigt Counter-Strike-liknande skjutspel där vapnen är fiskar." },
      { property: "og:title", content: "Fisk Strike" },
      { property: "og:description", content: "Skjut fiskar på kloner i en ökenarena." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FishGame,
});
