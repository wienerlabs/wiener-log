import { generateMap } from "@/lib/frp/mapgen";
import { initSim } from "@/lib/frp/worldsim";
import { hexesWithin, geographyQuests } from "@/lib/frp/movement";
import type { Campaign, Character } from "@/lib/frp/types";

const isHex = (s: string | null | undefined): boolean => /^-?\d+,-?\d+$/.test(s || "");

export function needsOverworldHeal(campaign: Campaign, characters: Character[]): boolean {
  if (!campaign.map_seed || campaign.status === "lobby" || campaign.status === "ended") return false;
  const badChar = characters.some((c) => c.alive && !isHex(c.location));
  const badDisc = (campaign.discovered || []).some((k) => !isHex(k));
  return badChar || badDisc || !campaign.map_state?.seeded;
}

export function healOverworldState(
  campaign: Campaign,
  characters: Character[],
): { fields: Partial<Campaign>; charLocations: { id: number; location: string }[] } {
  const map = generateMap(campaign.map_seed!);
  const startKey = `${map.start.q},${map.start.r}`;
  const charLocations = characters
    .filter((c) => c.alive && !isHex(c.location))
    .map((c) => ({ id: c.id, location: startKey }));
  const fields: Partial<Campaign> = {};

  const validDisc = (campaign.discovered || []).filter(isHex);
  fields.discovered = [...new Set([...validDisc, ...hexesWithin(map, startKey, 3)])];

  if (!campaign.map_state?.seeded) {
    fields.map_state = initSim(map, {
      time: campaign.map_state?.time ?? 6,
      weather: campaign.map_state?.weather || "clear",
      discovered_pois: campaign.map_state?.discovered_pois || [],
    });
  }

  if (!(campaign.quests || []).some((q) => q.id.startsWith("geo-"))) {
    const geo = geographyQuests(map, startKey);
    if (geo.length) fields.quests = [...(campaign.quests || []), ...geo];
  }

  return { fields, charLocations };
}
