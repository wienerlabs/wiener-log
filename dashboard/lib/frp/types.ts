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
  race: string;
  level: number;
  xp: number;
  hp_cur: number;
  hp_max: number;
  mp_cur: number;
  mp_max: number;
  stats: Stats;
  inventory: InventoryItem[];
  status_effects: StatusEffect[];
  corruption: Corruption;
  wielded: string | null;
  abilities: string[];
  gold: number;
  portrait_seed: string;
  alive: boolean;
  created_at: string;
}

export interface Enemy {
  name: string;
  sprite: string;
  hp: number;
  hp_max: number;
}

export interface Encounter {
  active: boolean;
  name: string;
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
  created_at: string;
  updated_at: string;
}

export type TurnKind =
  | "narration"
  | "action"
  | "talk"
  | "loot"
  | "combat"
  | "system"
  | "death"
  | "transform";

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
  add_items?: string[];
  remove_items?: string[];
  add_status?: StatusEffect[];
  remove_status?: string[];
  corruption?: Corruption;
  wield?: string | null;
  add_ability?: string[];
  set_alive?: boolean;
}

export interface HiddenRoll {
  label: string;
  result: number;
}

export interface GMResult {
  narration: string;
  effects?: Effect[];
  rolls?: HiddenRoll[];
  scene_update?: string;
  memory_update?: string;
  encounter?: Encounter | null;
  loot?: { handle: string; item: string }[];
  next_turn?: string;
}
