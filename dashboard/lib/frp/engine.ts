import { createNotification } from "@/lib/db";
import {
  getCampaign,
  getCharacters,
  getRecentTurns,
  appendTurn,
  updateCampaign,
  saveCharacter,
} from "@/lib/frp/db";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/frp/prompts";
import { rollPool, rollDie } from "@/lib/frp/dice";
import { locationByKey } from "@/lib/frp/locations";
import { houseById } from "@/lib/frp/houses";
import { SIN_LABEL_TR, itemNameTr } from "@/lib/frp/items";
import type {
  Character,
  Effect,
  GMResult,
  Sin,
  Encounter,
  Turn,
} from "@/lib/frp/types";

const ANTHROPIC = "https://api.anthropic.com/v1/messages";
const SINS: Sin[] = ["pride", "greed", "lust", "envy", "gluttony", "wrath", "sloth"];

const RESOLVE_TOOL = {
  name: "resolve_turn",
  description:
    "Resolve the current turn: narration plus every mechanical state change, keyed by character handle.",
  input_schema: {
    type: "object",
    properties: {
      narration: { type: "string", description: "Novel-quality prose the players read. No dice numbers, no offered choices." },
      effects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            handle: { type: "string" },
            hp_delta: { type: "number" },
            mp_delta: { type: "number" },
            xp_delta: { type: "number" },
            gold_delta: { type: "number", description: "coin change in COPPER (100 copper = 1 gold, 10 copper = 1 silver)" },
            armor_set: { type: "number", description: "set armor points to this exact value (only when armor is worn or fully broken to 0)" },
            armor_delta: { type: "number", description: "change armor points (negative when armor is damaged)" },
            add_items: { type: "array", items: { type: "string" } },
            remove_items: { type: "array", items: { type: "string" } },
            add_status: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  turns: { type: "number" },
                },
                required: ["id", "label"],
              },
            },
            remove_status: { type: "array", items: { type: "string" } },
            corruption: {
              type: "object",
              properties: {
                pride: { type: "number" },
                greed: { type: "number" },
                lust: { type: "number" },
                envy: { type: "number" },
                gluttony: { type: "number" },
                wrath: { type: "number" },
                sloth: { type: "number" },
              },
            },
            wield: { type: "string" },
            add_ability: { type: "array", items: { type: "string" } },
            set_alive: { type: "boolean" },
            controlled_by: {
              type: "string",
              description:
                "Set to a necromancer's handle to raise this fallen character as an undead minion under that necromancer's command.",
            },
          },
          required: ["handle"],
        },
      },
      rolls: {
        type: "array",
        description:
          "The key dice you actually rolled this turn (die type and result), so the table can see them. Pull results from the provided hidden pool.",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            die: { type: "number", description: "one of 4, 6, 8, 10, 12, 20" },
            result: { type: "number" },
          },
          required: ["label", "die", "result"],
        },
      },
      scene_update: { type: "string" },
      memory_update: { type: "string" },
      loot: {
        type: "array",
        items: {
          type: "object",
          properties: { handle: { type: "string" }, item: { type: "string" } },
          required: ["handle", "item"],
        },
      },
      location: {
        type: "string",
        description:
          "Key of a matching location image if the scene is clearly at one (big_city, outer_gate, courtyard, great_hall, blacksmith, market_square, watchtower); otherwise omit.",
      },
      fire: {
        type: "boolean",
        description: "true if something is burning in this scene (a fire, blaze, or flames), so the table sees flames rise.",
      },
      heralds: {
        type: "array",
        description: "Notable house nobles or royalty PRESENT in this scene as NPCs, so their banner (and crown if royal) shows by their name.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            house: { type: "string", description: "house key: kanli_tac, kara_kuzgun, gumus_kurt, altin_aslan, yesil_yilan, kizil_gul" },
            royal: { type: "boolean", description: "true if a king, queen, or crowned ruler" },
          },
          required: ["name", "house"],
        },
      },
      encounter: {
        type: "object",
        properties: {
          active: { type: "boolean" },
          name: { type: "string" },
          kind: { type: "string", description: "mob, boss, or dungeon" },
          enemies: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                hp: { type: "number" },
                hp_max: { type: "number" },
              },
              required: ["name", "hp", "hp_max"],
            },
          },
        },
        required: ["active", "name", "enemies"],
      },
      next_turn: { type: "string" },
    },
    required: ["narration"],
  },
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function noDash(s: string): string {
  return (s || "").replace(/[—–]/g, "-");
}

function enemySprite(name: string): string {
  const n = name.toLowerCase();
  if (/(wolf|beast|hound|boar|spider|rat)/.test(n)) return "en_wolf";
  if (/(skeleton|undead|bone|wraith|ghoul|revenant)/.test(n)) return "en_skeleton";
  if (/(cult|priest|acolyte|zealot|robe)/.test(n)) return "en_cultist";
  if (/(demon|devil|fiend|imp|hell|abyss)/.test(n)) return "en_demon";
  return "en_bandit";
}

function stageOf(v: number): number {
  return [25, 50, 75, 100].filter((t) => v >= t).length;
}

function applyEffect(c: Character, e: Effect): string[] {
  const notes: string[] = [];
  const before: Record<string, number> = {};
  for (const s of SINS) before[s] = c.corruption[s] || 0;

  if (e.hp_delta) c.hp_cur = clamp(c.hp_cur + e.hp_delta, 0, c.hp_max);
  if (e.mp_delta) c.mp_cur = clamp(c.mp_cur + e.mp_delta, 0, c.mp_max);
  if (e.xp_delta) c.xp = Math.max(0, c.xp + e.xp_delta);
  if (e.gold_delta) c.gold = Math.max(0, c.gold + e.gold_delta);
  if (e.armor_set !== undefined) c.armor = Math.max(0, Math.round(e.armor_set));
  if (e.armor_delta) c.armor = Math.max(0, c.armor + e.armor_delta);
  if (e.add_items) for (const id of e.add_items) c.inventory.push({ id });
  if (e.remove_items)
    for (const id of e.remove_items) {
      const idx = c.inventory.findIndex((i) => i.id === id);
      if (idx >= 0) c.inventory.splice(idx, 1);
    }
  if (e.add_status)
    for (const s of e.add_status)
      if (!c.status_effects.find((x) => x.id === s.id)) c.status_effects.push(s);
  if (e.remove_status)
    c.status_effects = c.status_effects.filter(
      (s) => !e.remove_status!.includes(s.id),
    );
  if (e.corruption)
    for (const [k, v] of Object.entries(e.corruption)) {
      const sin = k as Sin;
      if (!SINS.includes(sin)) continue;
      c.corruption[sin] = clamp((c.corruption[sin] || 0) + (v as number), 0, 100);
    }
  if (e.wield !== undefined) c.wielded = e.wield || null;
  if (e.controlled_by !== undefined) {
    const nb = e.controlled_by || null;
    if (nb && nb !== c.controlled_by) notes.push(`raised:${nb}`);
    c.controlled_by = nb;
  }
  if (e.add_ability)
    for (const a of e.add_ability) if (!c.abilities.includes(a)) c.abilities.push(a);
  if (e.set_alive !== undefined) c.alive = e.set_alive;

  while (c.xp >= c.level * 120) {
    c.xp -= c.level * 120;
    c.level += 1;
    c.hp_max += 6;
    c.mp_max += 3;
    c.hp_cur = Math.min(c.hp_max, c.hp_cur + 6);
    c.mp_cur = Math.min(c.mp_max, c.mp_cur + 3);
    notes.push(`level:${c.level}`);
  }

  for (const s of SINS) {
    const after = c.corruption[s] || 0;
    if (stageOf(after) > stageOf(before[s])) {
      if (after >= 100) {
        c.alive = false;
        notes.push(`lost:${s}`);
      } else {
        notes.push(`corrupt:${s}:${after}`);
      }
    }
  }
  if (c.hp_cur <= 0 && c.alive) {
    c.alive = false;
    notes.push("death");
  }
  return notes;
}

async function callGM(
  model: string,
  userPrompt: string,
  maxTokens: number,
): Promise<GMResult | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(ANTHROPIC, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.85,
        system: SYSTEM_PROMPT,
        tools: [RESOLVE_TOOL],
        tool_choice: { type: "tool", name: "resolve_turn" },
        messages: [{ role: "user", content: userPrompt }],
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: { type: string; input?: unknown }[];
    };
    const tool = data.content?.find((b) => b.type === "tool_use");
    if (!tool?.input) return null;
    return tool.input as GMResult;
  } catch {
    return null;
  }
}

export interface TurnResult {
  ok: boolean;
  narration?: string;
  error?: string;
}

export async function resolveTurn(
  campaignId: number,
  actorHandle: string,
  action: string,
  opts: { isOpening?: boolean } = {},
): Promise<TurnResult> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return { ok: false, error: "campaign not found" };
  const characters = await getCharacters(campaignId);
  const recent = await getRecentTurns(campaignId, 16);
  const pool = rollPool();
  const wild = rollDie(100) <= 15;
  const model =
    process.env.FRP_GM_MODEL || campaign.gm_model || "claude-haiku-4-5";

  const userPrompt = buildUserPrompt(
    campaign,
    characters,
    recent,
    actorHandle,
    action,
    pool,
    wild,
  );
  const maxTokens = opts.isOpening ? 1200 : 640;
  const gm = await callGM(model, userPrompt, maxTokens);

  if (!gm) {
    await appendTurn(
      campaignId,
      "gm",
      "system",
      "Kaderin iplikleri düğümlendi. Anlatıcı bir an durakladı; birazdan tekrar dene.",
      null,
      campaign.round,
    );
    return { ok: false, error: "gm unavailable" };
  }

  if (!opts.isOpening && (!gm.rolls || gm.rolls.length === 0)) {
    gm.rolls = [{ label: "Kader", die: 20, result: pool.d20[0] }];
  }

  const byHandle = new Map(characters.map((c) => [c.handle, c]));
  const extraTurns: { kind: Turn["kind"]; content: string; actor: string }[] = [];

  for (const e of gm.effects || []) {
    const c = byHandle.get(e.handle);
    if (!c) continue;
    const notes = applyEffect(c, e);
    for (const n of notes) {
      if (n.startsWith("level:"))
        extraTurns.push({ kind: "system", actor: c.handle, content: `${c.name} ${n.split(":")[1]}. seviyeye ulaştı.` });
      else if (n.startsWith("lost:"))
        extraTurns.push({ kind: "transform", actor: c.handle, content: `${c.name}, ${SIN_LABEL_TR[n.split(":")[1] as Sin]} günahına yenik düştü. Artık ona ait.` });
      else if (n.startsWith("corrupt:")) {
        const [, sin, val] = n.split(":");
        extraTurns.push({ kind: "transform", actor: c.handle, content: `${c.name}, ${SIN_LABEL_TR[sin as Sin]} tarafından daha da ele geçiriliyor. (${val}/100)` });
      } else if (n.startsWith("raised:"))
        extraTurns.push({ kind: "transform", actor: c.handle, content: `${c.name}, @${n.split(":")[1]} tarafından mezardan çağrıldı. Artık onun hizmetinde savaşıyor.` });
      else if (n === "death")
        extraTurns.push({ kind: "death", actor: c.handle, content: `${c.name} düştü. Hikâyesi burada bitti.` });
    }
  }

  const necros = characters.filter(
    (c) => (c.class === "necromancer" || c.class2 === "necromancer") && c.alive,
  );
  for (const n of necros) {
    const cap = Math.floor(n.level / 3) + 1;
    const raised = characters.filter((c) => c.controlled_by === n.handle);
    if (raised.length > cap)
      for (const r of raised.slice(cap)) r.controlled_by = null;
  }

  for (const c of characters) await saveCharacter(c);

  const narration = noDash(gm.narration || "");
  const rolls = gm.rolls || [];
  const location = gm.location && locationByKey(gm.location) ? gm.location : null;
  const fire =
    !!gm.fire ||
    /(yan[ıi]yor|yang[ıi]n|alev|tutu[şs]|ate[şs]e ver|k[üu]l ol|yak[ıi]l|cehennem)/i.test(
      narration,
    );
  const heralds = (gm.heralds || [])
    .filter((h) => h && h.name && houseById(h.house))
    .slice(0, 6)
    .map((h) => ({ name: noDash(h.name), house: h.house, royal: !!h.royal }));
  await appendTurn(
    campaignId,
    "gm",
    "narration",
    narration,
    { rolls, dice: pool, loot: gm.loot || [], location, fire, heralds },
    campaign.round,
  );
  for (const lt of gm.loot || []) {
    extraTurns.push({ kind: "loot", actor: lt.handle, content: `${lt.handle}, ${itemNameTr(lt.item)} buldu.` });
  }
  for (const t of extraTurns)
    await appendTurn(campaignId, t.actor, t.kind, noDash(t.content), null, campaign.round);

  let encounter: Encounter | null = campaign.encounter;
  if (gm.encounter) {
    if (!gm.encounter.active) encounter = null;
    else
      encounter = {
        active: true,
        name: noDash(gm.encounter.name),
        kind: gm.encounter.kind === "boss" || gm.encounter.kind === "dungeon" ? gm.encounter.kind : "mob",
        enemies: (gm.encounter.enemies || []).map((en) => ({
          name: noDash(en.name),
          sprite: enemySprite(en.name),
          hp: Math.max(0, Math.round(en.hp)),
          hp_max: Math.max(1, Math.round(en.hp_max)),
        })),
      };
  }

  const living = campaign.turn_order.filter((h) => byHandle.get(h)?.alive);
  let next = actorHandle;
  let round = campaign.round;
  if (opts.isOpening) {
    next = living[0] || actorHandle;
    round = 1;
  } else if (living.length) {
    const idx = living.indexOf(actorHandle);
    const ni = (idx + 1) % living.length;
    next = living[ni];
    if (ni === 0) round += 1;
  }

  const memory =
    noDash(gm.memory_update || "") ||
    (campaign.state_summary?.memory as string) ||
    "";
  await updateCampaign(campaignId, {
    status: "active",
    current_scene: noDash(gm.scene_update || "") || campaign.current_scene,
    state_summary: { ...campaign.state_summary, memory },
    turn_order: campaign.turn_order,
    current_turn: next,
    round,
    encounter,
  });

  if (next && next !== actorHandle) {
    try {
      await createNotification({
        recipient: next,
        actor: "gm",
        kind: "frp_turn",
        body: `"${campaign.title}" efsanesinde sıra sende`,
        link: `/tavern/${campaignId}`,
      });
    } catch {
      /* best effort */
    }
  }

  return { ok: true, narration };
}
