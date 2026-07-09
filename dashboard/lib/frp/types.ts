export type CampaignStatus = "lobby" | "active" | "paused" | "ended";

export interface Stats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export type Sin =
  | "pride"
  | "greed"
  | "lust"
  | "envy"
  | "gluttony"
  | "wrath"
  | "sloth";

export type Corruption = Partial<Record<Sin, number>>;

export interface InventoryItem {
  id: string;
  qty?: number;
}

export interface StatusEffect {
  id: string;
  label: string;
  turns?: number;
}

export interface Character {
  id: number;
  campaign_id: number;
  handle: string;
  name: string;
  class: string;
  class2: string | null;
  race: string;
  house: string | null;
  controlled_by: string | null;
  level: number;
  xp: number;
  hp_cur: number;
  hp_max: number;
  mp_cur: number;
  mp_max: number;
  armor: number;
  stats: Stats;
  inventory: InventoryItem[];
  status_effects: StatusEffect[];
  corruption: Corruption;
  wielded: string | null;
  abilities: string[];
  gold: number;
  location: string;
  portrait_seed: string;
  alive: boolean;
  created_at: string;
}

export interface Enemy {
  name: string;
  sprite: string;
  hp: number;
  hp_max: number;
  telegraph?: string;
}

export interface Encounter {
  active: boolean;
  name: string;
  kind?: "mob" | "boss" | "dungeon";
  enemies: Enemy[];
}

export interface Campaign {
  id: number;
  title: string;
  setting: string;
  tone: string | null;
  status: CampaignStatus;
  host: string;
  gm_model: string;
  difficulty: string;
  current_scene: string | null;
  state_summary: Record<string, unknown>;
  turn_order: string[];
  current_turn: string | null;
  round: number;
  encounter: Encounter | null;
  doom: number;
  quests: Quest[];
  reputation: Record<string, number>;
  current_location: string | null;
  position: string | null;
  discovered: string[];
  created_at: string;
  updated_at: string;
}

export interface WorldState {
  doom: number;
  factions: Record<string, number>;
  relics: Sin[];
  node_control: Record<string, string>;
  updated_at?: string;
}

export interface WorldEvent {
  id: number;
  campaign_id: number | null;
  kind: string;
  text: string;
  house: string | null;
  created_at: string;
}

export interface Quest {
  id: string;
  title: string;
  status: "active" | "done" | "failed";
  kind?: "main" | "side";
}

export type TurnKind =
  | "narration"
  | "action"
  | "talk"
  | "loot"
  | "combat"
  | "system"
  | "death"
  | "transform"
  | "levelup";

export interface Turn {
  id: number;
  campaign_id: number;
  actor: string;
  kind: TurnKind;
  content: string | null;
  payload: Record<string, unknown> | null;
  round: number;
  created_at: string;
}

export interface Effect {
  handle: string;
  hp_delta?: number;
  mp_delta?: number;
  xp_delta?: number;
  gold_delta?: number;
  armor_delta?: number;
  armor_set?: number;
  add_items?: string[];
  remove_items?: string[];
  add_status?: StatusEffect[];
  remove_status?: string[];
  corruption?: Corruption;
  wield?: string | null;
  add_ability?: string[];
  set_alive?: boolean;
  controlled_by?: string | null;
}

export interface HiddenRoll {
  label: string;
  die: number;
  result: number;
}

export interface GMResult {
  narration: string;
  effects?: Effect[];
  rolls?: HiddenRoll[];
  scene_update?: string;
  memory_update?: string;
  encounter?: Encounter | null;
  loot?: { handle: string; item: string; rarity?: string }[];
  location?: string;
  fire?: boolean;
  heralds?: { name: string; house: string; royal?: boolean }[];
  doom_delta?: number;
  quests?: Quest[];
  reputation?: Record<string, number>;
  world_event?: string;
  world_doom_delta?: number;
  faction_delta?: Record<string, number>;
  captures?: { node: string; house: string }[];
  impossible?: boolean;
  reason?: string;
  next_turn?: string;
}

export interface Herald {
  name: string;
  house: string;
  royal?: boolean;
}
