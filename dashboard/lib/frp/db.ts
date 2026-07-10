import { sql } from "@/lib/db";
import type { Campaign, Character, Turn, TurnKind, Encounter } from "@/lib/frp/types";
import { START_NODE } from "@/lib/frp/worldmap";

const CAMPAIGN_COLS = `id, title, setting, tone, status, host, gm_model, difficulty,
  current_scene, state_summary, turn_order, current_turn, round, encounter,
  created_at, updated_at`;

export async function createCampaign(input: {
  title: string;
  setting: string;
  tone: string;
  host: string;
  gm_model: string;
  difficulty: string;
  map_seed: string;
}): Promise<number> {
  const rows = (await sql`
    INSERT INTO campaigns (title, setting, tone, host, gm_model, difficulty, status, turn_order, position, discovered, map_seed)
    VALUES (${input.title}, ${input.setting}, ${input.tone}, ${input.host},
            ${input.gm_model}, ${input.difficulty}, 'lobby', '[]'::jsonb, ${START_NODE}, ${JSON.stringify([START_NODE])}::jsonb, ${input.map_seed})
    RETURNING id
  `) as { id: number }[];
  return rows[0].id;
}

export interface CampaignPartyMember {
  name: string;
  seed: string;
  cls: string;
  race: string | null;
  house: string | null;
  handle: string;
}

export interface CampaignListRow {
  id: number;
  title: string;
  setting: string;
  tone: string | null;
  status: string;
  host: string;
  difficulty: string;
  round: number;
  updated_at: string;
  party_size: number;
  joined: boolean;
  map_seed: string | null;
  doom: number;
  current_turn: string | null;
  factions: Record<string, number> | null;
  party: CampaignPartyMember[] | null;
}

export async function listCampaigns(handle: string): Promise<CampaignListRow[]> {
  return (await sql`
    SELECT c.id, c.title, c.setting, c.tone, c.status, c.host, c.difficulty,
      c.round, c.updated_at, c.map_seed, c.doom, c.current_turn, c.factions,
      (SELECT count(*)::int FROM characters ch WHERE ch.campaign_id = c.id) AS party_size,
      EXISTS(SELECT 1 FROM characters ch WHERE ch.campaign_id = c.id AND ch.handle = ${handle}) AS joined,
      (SELECT json_agg(json_build_object('name', ch.name, 'seed', ch.portrait_seed, 'cls', ch.class, 'race', ch.race, 'house', ch.house, 'handle', ch.handle) ORDER BY ch.created_at)
        FROM characters ch WHERE ch.campaign_id = c.id) AS party
    FROM campaigns c
    WHERE c.status IN ('lobby', 'active', 'paused')
    ORDER BY c.updated_at DESC
  `) as CampaignListRow[];
}

export async function getCampaign(id: number): Promise<Campaign | null> {
  const rows = (await sql`
    SELECT id, title, setting, tone, status, host, gm_model, difficulty,
      current_scene, state_summary, turn_order, current_turn, round, encounter,
      doom, quests, reputation, current_location, position, discovered,
      relics, factions, node_control, map_seed, map_state,
      created_at, updated_at
    FROM campaigns WHERE id = ${id} LIMIT 1
  `) as Campaign[];
  return rows[0] ?? null;
}

export async function updateCampaign(
  id: number,
  fields: {
    status: string;
    current_scene: string | null;
    state_summary: Record<string, unknown>;
    turn_order: string[];
    current_turn: string | null;
    round: number;
    encounter: Encounter | null;
    doom?: number;
    quests?: unknown[];
    reputation?: Record<string, number>;
    current_location?: string | null;
    position?: string | null;
    discovered?: string[];
    relics?: unknown[];
    factions?: Record<string, number>;
    node_control?: Record<string, string>;
    map_state?: Record<string, unknown>;
  },
): Promise<void> {
  await sql`
    UPDATE campaigns SET
      status = ${fields.status},
      current_scene = ${fields.current_scene},
      state_summary = ${JSON.stringify(fields.state_summary)}::jsonb,
      turn_order = ${JSON.stringify(fields.turn_order)}::jsonb,
      current_turn = ${fields.current_turn},
      round = ${fields.round},
      encounter = ${fields.encounter ? JSON.stringify(fields.encounter) : null}::jsonb,
      doom = ${fields.doom ?? 0},
      quests = ${JSON.stringify(fields.quests ?? [])}::jsonb,
      reputation = ${JSON.stringify(fields.reputation ?? {})}::jsonb,
      current_location = ${fields.current_location ?? null},
      position = ${fields.position ?? START_NODE},
      discovered = ${JSON.stringify(fields.discovered ?? [START_NODE])}::jsonb,
      relics = ${JSON.stringify(fields.relics ?? [])}::jsonb,
      factions = ${JSON.stringify(fields.factions ?? {})}::jsonb,
      node_control = ${JSON.stringify(fields.node_control ?? {})}::jsonb,
      map_state = ${JSON.stringify(fields.map_state ?? {})}::jsonb,
      updated_at = now()
    WHERE id = ${id}
  `;
}

const CHAR_COLS = `id, campaign_id, handle, name, class, race, level, xp,
  hp_cur, hp_max, mp_cur, mp_max, stats, inventory, status_effects,
  corruption, wielded, abilities, gold, portrait_seed, alive, created_at`;

export async function getCharacters(campaignId: number): Promise<Character[]> {
  return (await sql`
    SELECT id, campaign_id, handle, name, class, class2, race, house, controlled_by,
      level, xp, hp_cur, hp_max, mp_cur, mp_max, armor, stats, inventory, status_effects,
      corruption, wielded, abilities, gold, location, mount, portrait_seed, alive, created_at
    FROM characters WHERE campaign_id = ${campaignId} ORDER BY id ASC
  `) as Character[];
}

export async function getCharacter(
  campaignId: number,
  handle: string,
): Promise<Character | null> {
  const rows = (await sql`
    SELECT id, campaign_id, handle, name, class, class2, race, house, controlled_by,
      level, xp, hp_cur, hp_max, mp_cur, mp_max, armor, stats, inventory, status_effects,
      corruption, wielded, abilities, gold, location, mount, portrait_seed, alive, created_at
    FROM characters WHERE campaign_id = ${campaignId} AND handle = ${handle} LIMIT 1
  `) as Character[];
  return rows[0] ?? null;
}

export async function createCharacter(c: {
  campaign_id: number;
  handle: string;
  name: string;
  cls: string;
  cls2?: string | null;
  race: string;
  house?: string | null;
  hp: number;
  mp: number;
  coin?: number;
  stats: Record<string, number>;
  inventory: { id: string }[];
  abilities: string[];
  portrait_seed: string;
}): Promise<void> {
  await sql`
    INSERT INTO characters (campaign_id, handle, name, class, class2, race, house,
      hp_cur, hp_max, mp_cur, mp_max, stats, inventory, abilities, portrait_seed, gold, location)
    VALUES (${c.campaign_id}, ${c.handle}, ${c.name}, ${c.cls}, ${c.cls2 ?? null}, ${c.race}, ${c.house ?? null},
      ${c.hp}, ${c.hp}, ${c.mp}, ${c.mp},
      ${JSON.stringify(c.stats)}::jsonb, ${JSON.stringify(c.inventory)}::jsonb,
      ${JSON.stringify(c.abilities)}::jsonb, ${c.portrait_seed}, ${c.coin ?? 30}, ${START_NODE})
    ON CONFLICT (campaign_id, handle) DO NOTHING
  `;
}

export async function saveCharacter(c: Character): Promise<void> {
  await sql`
    UPDATE characters SET
      level = ${c.level}, xp = ${c.xp},
      hp_cur = ${c.hp_cur}, hp_max = ${c.hp_max},
      mp_cur = ${c.mp_cur}, mp_max = ${c.mp_max},
      armor = ${c.armor},
      inventory = ${JSON.stringify(c.inventory)}::jsonb,
      status_effects = ${JSON.stringify(c.status_effects)}::jsonb,
      corruption = ${JSON.stringify(c.corruption)}::jsonb,
      wielded = ${c.wielded},
      abilities = ${JSON.stringify(c.abilities)}::jsonb,
      gold = ${c.gold},
      location = ${c.location},
      mount = ${c.mount},
      alive = ${c.alive},
      controlled_by = ${c.controlled_by}
    WHERE id = ${c.id}
  `;
}

export async function getTurns(
  campaignId: number,
  afterId = 0,
  limit = 60,
): Promise<Turn[]> {
  return (await sql`
    SELECT id, campaign_id, actor, kind, content, payload, round, created_at
    FROM campaign_turns
    WHERE campaign_id = ${campaignId} AND id > ${afterId}
    ORDER BY id ASC LIMIT ${limit}
  `) as Turn[];
}

export async function getRecentTurns(
  campaignId: number,
  limit = 16,
): Promise<Turn[]> {
  const rows = (await sql`
    SELECT id, campaign_id, actor, kind, content, payload, round, created_at
    FROM campaign_turns
    WHERE campaign_id = ${campaignId} AND kind IN ('narration', 'action', 'combat', 'transform', 'death')
    ORDER BY id DESC LIMIT ${limit}
  `) as Turn[];
  return rows.reverse();
}

export async function lastActionText(
  campaignId: number,
  actor: string,
): Promise<string | null> {
  const rows = (await sql`
    SELECT content FROM campaign_turns
    WHERE campaign_id = ${campaignId} AND actor = ${actor} AND kind = 'action'
    ORDER BY id DESC LIMIT 1
  `) as { content: string | null }[];
  return rows[0]?.content ?? null;
}

export async function restartCampaign(campaignId: number): Promise<void> {
  await sql`DELETE FROM campaign_turns WHERE campaign_id = ${campaignId}`;
  await sql`DELETE FROM frp_world_events WHERE campaign_id = ${campaignId}`;
  await sql`
    UPDATE characters SET
      hp_cur = hp_max, mp_cur = mp_max, armor = 0,
      status_effects = '[]'::jsonb, corruption = '{}'::jsonb,
      wielded = null, alive = true, controlled_by = null,
      location = ${START_NODE}
    WHERE campaign_id = ${campaignId}
  `;
  await sql`
    UPDATE campaigns SET
      status = 'lobby', current_scene = null,
      state_summary = '{}'::jsonb, current_turn = null,
      round = 0, encounter = null,
      doom = 0, quests = '[]'::jsonb, reputation = '{}'::jsonb, current_location = null,
      position = ${START_NODE}, discovered = ${JSON.stringify([START_NODE])}::jsonb,
      relics = '[]'::jsonb, factions = '{}'::jsonb, node_control = '{}'::jsonb,
      updated_at = now()
    WHERE id = ${campaignId}
  `;
}

export async function appendTurn(
  campaignId: number,
  actor: string,
  kind: TurnKind,
  content: string | null,
  payload: Record<string, unknown> | null,
  round: number,
): Promise<Turn> {
  const rows = (await sql`
    INSERT INTO campaign_turns (campaign_id, actor, kind, content, payload, round)
    VALUES (${campaignId}, ${actor}, ${kind}, ${content},
      ${payload ? JSON.stringify(payload) : null}::jsonb, ${round})
    RETURNING id, campaign_id, actor, kind, content, payload, round, created_at
  `) as Turn[];
  return rows[0];
}
