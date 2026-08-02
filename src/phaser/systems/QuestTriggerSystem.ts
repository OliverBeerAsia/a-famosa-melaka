/**
 * QuestTriggerSystem — the quest layer that lives IN the world rather than in
 * the journal: the scripted hotspots a quest opens up, and the beacon over the
 * player's tracked objective.
 *
 * Hotspots are conditional by construction — each declares its own
 * `isAvailable()` — so the counting-house door simply is not there until the
 * theft path is live and the sun is down. Availability is re-checked every
 * frame rather than at spawn, because the conditions (quest stage, hour) move
 * underneath the player.
 *
 * The objective marker resolves the tracked objective to a world anchor by
 * type: talk/give/pay resolve through the NPC's home location, location/go
 * resolve to the location itself, search/stealth to a named point of interest,
 * obtain/find/collect to wherever that item is actually lying. It re-resolves
 * only when its signature changes, so it is cheap to call every frame.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../game';
import { getLocationItems, LOCATION_IDS } from '../core/LocationData';
import { emitGameEvent } from '../eventBridge';
import { useDialogueStore } from '../../stores/dialogueStore';
import { useQuestStore } from '../../stores/questStore';
import objectiveMarkersData from '../../data/objective-markers.json';
import type { SystemContext } from '../core/SystemContext';
import {
  INTERACTION_PRIORITY,
} from '../core/interactionScore';
import type {
  InteractionCandidate,
  InteractionScan,
  InteractionSystem,
} from './InteractionSystem';

interface MarkerAnchor { x: number; y: number }

interface ObjectiveMarkerDefinition {
  questId: string;
  objectiveId: string;
  objectiveType: string;
  objectiveText: string;
  locationId: string;
  anchor: MarkerAnchor;
}

interface QuestHotspot {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  isAvailable: () => boolean;
  onInteract: () => void;
  glow: Phaser.GameObjects.Ellipse;
  marker: Phaser.GameObjects.Arc;
  labelText: Phaser.GameObjects.Text;
}

export interface QuestTriggerDeps {
  /** Toast for scripted feedback ("You recover the trading seal."). */
  notify(text: string): void;
}

export class QuestTriggerSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;
  private readonly deps: QuestTriggerDeps;

  private hotspots: QuestHotspot[] = [];
  private objectiveMarker: {
    definition: ObjectiveMarkerDefinition;
    beam: Phaser.GameObjects.Ellipse;
    beacon: Phaser.GameObjects.Arc;
    ring: Phaser.GameObjects.Arc;
    label: Phaser.GameObjects.Text;
  } | null = null;
  private lastObjectiveSignature: string | null = null;

  constructor(scene: Phaser.Scene, ctx: SystemContext, deps: QuestTriggerDeps) {
    this.scene = scene;
    this.ctx = ctx;
    this.deps = deps;
  }

  getObjectiveAnchors() {
    return (objectiveMarkersData as { anchors: Record<string, Record<string, MarkerAnchor>> }).anchors || {};
  }

  findLocationForAnchorKey(anchorKey: string): string | null {
    const anchors = this.getObjectiveAnchors();
    return Object.keys(anchors).find((locationId) => Boolean(anchors[locationId]?.[anchorKey])) || null;
  }

  resolveObjectiveMarker(): ObjectiveMarkerDefinition | null {
    const tracked = useQuestStore.getState().getTrackedObjective();
    if (!tracked) return null;

    const objective = tracked.objective;
    const anchors = this.getObjectiveAnchors();
    const npcData = useDialogueStore.getState().allNPCData as Record<string, { location?: string }>;
    const worldItems: Record<string, Array<{ itemId: string; x: number; y: number }>> =
      Object.fromEntries(LOCATION_IDS.map((id) => [id, getLocationItems(id)]));

    let locationId: string | null = null;
    let anchorKey: string | null = null;
    let directAnchor: MarkerAnchor | null = null;

    if (['talk', 'give', 'pay'].includes(objective.type) && objective.target) {
      locationId = npcData[objective.target]?.location || null;
      anchorKey = `npc:${objective.target}`;
    } else if (['location', 'go', 'explore'].includes(objective.type) && objective.target) {
      locationId = objective.target;
      anchorKey = `location:${objective.target}`;
    } else if (['search', 'stealth'].includes(objective.type) && objective.target) {
      anchorKey = `poi:${objective.target}`;
      locationId = this.findLocationForAnchorKey(anchorKey);
    } else if (objective.type === 'escort') {
      if (objective.target) {
        anchorKey = `poi:${objective.target}`;
        locationId = this.findLocationForAnchorKey(anchorKey);
      }
      if (!locationId && objective.destination) {
        anchorKey = `location:${objective.destination}`;
        locationId = objective.destination;
      }
    } else if (['obtain', 'find', 'collect'].includes(objective.type)) {
      const itemId = objective.item || objective.target;
      if (itemId) {
        const match = Object.entries(worldItems).find(([, entries]) =>
          entries.some((entry) => entry.itemId === itemId)
        );
        if (match) {
          locationId = match[0];
          const found = match[1].find((entry) => entry.itemId === itemId);
          if (found) {
            directAnchor = { x: found.x, y: found.y };
          }
        }
      }
    }

    if (!locationId) {
      locationId = this.ctx.locationId();
    }

    const locationAnchors = anchors[locationId] || {};
    let anchor: MarkerAnchor | null = directAnchor || (anchorKey ? locationAnchors[anchorKey] || null : null);
    if (!anchor && objective.target) {
      anchor = locationAnchors[`poi:${objective.target}`] || null;
    }

    if (!anchor) {
      anchor = locationAnchors[`location:${locationId}`] || { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };
    }

    return {
      questId: tracked.questId,
      objectiveId: objective.id,
      objectiveType: objective.type,
      objectiveText: objective.description,
      locationId,
      anchor,
    };
  }

  destroyObjectiveMarker() {
    if (!this.objectiveMarker) return;
    this.objectiveMarker.beam.destroy();
    this.objectiveMarker.beacon.destroy();
    this.objectiveMarker.ring.destroy();
    this.objectiveMarker.label.destroy();
    this.objectiveMarker = null;
  }

  refreshObjectiveMarker(force: boolean = false) {
    const definition = this.resolveObjectiveMarker();
    const signature = definition
      ? `${definition.questId}:${definition.objectiveId}:${definition.locationId}:${definition.anchor.x}:${definition.anchor.y}`
      : 'none';

    if (!force && signature === this.lastObjectiveSignature) {
      return;
    }

    this.lastObjectiveSignature = signature;

    if (!definition || definition.locationId !== this.ctx.locationId()) {
      this.destroyObjectiveMarker();
      return;
    }

    this.destroyObjectiveMarker();

    const beam = this.scene.add.ellipse(
      definition.anchor.x,
      definition.anchor.y - 46,
      20,
      94,
      0xF0D9A1,
      0.12 * this.ctx.visualProfile().colorGradeStrength
    );
    beam.setDepth(988);
    beam.setBlendMode(Phaser.BlendModes.SCREEN);

    const ring = this.scene.add.circle(definition.anchor.x, definition.anchor.y + 2, 18, 0xD4AF37, 0.22);
    ring.setStrokeStyle(2, 0xF4B41A, 0.75);
    ring.setDepth(989);

    const beacon = this.scene.add.circle(definition.anchor.x, definition.anchor.y - 22, 7, 0xFFD36A, 0.9);
    beacon.setDepth(990);
    beacon.setBlendMode(Phaser.BlendModes.ADD);

    const label = this.scene.add.text(definition.anchor.x, definition.anchor.y - 38, 'Objective', {
      font: '11px Cinzel, Georgia, serif',
      color: '#F4E6BE',
      stroke: '#000000',
      strokeThickness: 2,
    });
    label.setOrigin(0.5, 1);
    label.setDepth(991);

    this.objectiveMarker = { definition, beam, beacon, ring, label };
  }

  updateObjectiveMarker() {
    this.refreshObjectiveMarker(false);
    if (!this.objectiveMarker) return;

    this.objectiveMarker.beam.setAlpha(0.08 + Math.sin(this.scene.time.now / 260) * 0.03);
    const pulse = 1 + Math.sin(this.scene.time.now / 220) * 0.12;
    this.objectiveMarker.ring.setScale(pulse);
    this.objectiveMarker.beacon.setScale(1 + Math.sin(this.scene.time.now / 180) * 0.08);
  }

  // -- quest hotspots ------------------------------------------------------

  /**
   * Build this location's scripted hotspots.
   *
   * The demo ships two, both on the waterfront theft path. They stay as code
   * rather than data because their availability reads quest STAGE, which no
   * declarative form in the location schema expresses yet; the shape here is
   * deliberately the one a data-driven version would take.
   */
  create() {
    this.destroyHotspots();
    if (this.ctx.locationId() !== 'waterfront') return;

    this.hotspots.push(this.makeHotspot({
      id: 'merchants-seal-counting-house-entry',
      label: 'Slip into the counting house',
      x: 620,
      y: 250,
      radius: 90,
      isAvailable: () => this.isTheftEntryAvailable(),
      onInteract: () => {
        const quest = useQuestStore.getState().activeQuests.find((q) => q.id === 'merchants-seal');
        if (!quest) return;
        if (quest.currentStageId === 'choose-path') {
          emitGameEvent('quest:path:request', 'theft');
        }
        useQuestStore.getState().recordLocation(this.ctx.locationId());
        useQuestStore.getState().recordStealth('counting-house');
        this.deps.notify('You sneak close to the counting house door...');
      },
    }));

    this.hotspots.push(this.makeHotspot({
      id: 'merchants-seal-drawer-search',
      label: 'Search the ledger drawer',
      x: 575,
      y: 235,
      radius: 78,
      isAvailable: () => this.isDrawerAvailable(),
      onInteract: () => {
        useQuestStore.getState().recordSearch('counting-house-drawer');
        this.deps.notify('You recover the trading seal.');
      },
    }));
  }

  private makeHotspot(config: {
    id: string;
    label: string;
    x: number;
    y: number;
    radius: number;
    isAvailable: () => boolean;
    onInteract: () => void;
  }): QuestHotspot {
    const glow = this.scene.add.ellipse(config.x, config.y, 44, 18, 0xCFA34A, 0.1);
    glow.setDepth(978);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    const marker = this.scene.add.circle(config.x, config.y, 7, 0xCFA34A, 0.85);
    marker.setStrokeStyle(2, 0x3b2509, 1);
    marker.setDepth(979);

    const labelText = this.scene.add.text(config.x, config.y - 22, config.label, {
      font: 'italic 11px Cinzel, Georgia, serif',
      color: '#F4E6BE',
      stroke: '#000000',
      strokeThickness: 2,
    });
    labelText.setOrigin(0.5, 1);
    labelText.setDepth(980);
    labelText.setVisible(false);

    return { ...config, glow, marker, labelText };
  }

  private isTheftEntryAvailable(): boolean {
    const stage = useQuestStore.getState().getQuestStage('merchants-seal');
    if (!stage) return false;
    return ['choose-path', 'theft-attempt', 'theft-choice'].includes(stage.id)
      && this.ctx.timeOfDay() === 'night';
  }

  private isDrawerAvailable(): boolean {
    const stage = useQuestStore.getState().getQuestStage('merchants-seal');
    return Boolean(stage?.id === 'theft-success' && this.ctx.timeOfDay() === 'night');
  }

  // -- interaction ---------------------------------------------------------

  registerInteractions(interaction: InteractionSystem) {
    interaction.registerProvider((scan: InteractionScan) => {
      const out: InteractionCandidate[] = [];
      for (const hotspot of this.hotspots) {
        if (!hotspot.isAvailable()) continue;
        const scored = scan.score(hotspot.x, hotspot.y, hotspot.radius);
        if (!scored) continue;
        out.push({
          type: 'quest',
          id: hotspot.id,
          label: hotspot.label,
          x: hotspot.x,
          y: hotspot.y,
          priority: INTERACTION_PRIORITY.quest,
          score: scored.score,
          interact: hotspot.onInteract,
        });
      }
      return out;
    });
  }

  // -- per frame -----------------------------------------------------------

  update(targetedQuestId: string | null) {
    this.updateObjectiveMarker();

    this.hotspots.forEach((hotspot) => {
      const visible = hotspot.isAvailable();
      hotspot.glow.setVisible(visible);
      hotspot.marker.setVisible(visible);
      hotspot.labelText.setVisible(false);

      if (!visible) return;

      const nearby = hotspot.id === targetedQuestId;
      hotspot.labelText.setVisible(nearby);
      hotspot.glow.setAlpha(nearby ? 0.22 : 0.08);
      hotspot.glow.setScale(nearby ? 1.1 + Math.sin(this.scene.time.now / 240) * 0.08 : 1);
      hotspot.marker.setScale(nearby ? 1 + Math.sin(this.scene.time.now / 200) * 0.2 : 1);
    });
  }

  private destroyHotspots() {
    this.hotspots.forEach((hotspot) => {
      hotspot.glow.destroy();
      hotspot.marker.destroy();
      hotspot.labelText.destroy();
    });
    this.hotspots = [];
  }

  destroy() {
    this.destroyHotspots();
    this.destroyObjectiveMarker();
    this.lastObjectiveSignature = null;
  }
}
