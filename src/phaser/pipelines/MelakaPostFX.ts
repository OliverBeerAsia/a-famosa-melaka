/**
 * MelakaPostFX — the whole screen-space grade, in one fragment pass.
 *
 * WHAT IT REPLACES
 * ----------------
 * Fourteen to twenty blended Game Objects and ~9 perpetual tweens per frame:
 * a vignette Graphics, four edge-AO rects, two authored AO-zone rects, two or
 * three canopy-shadow ellipses, a SCREEN colour-grade rect, a MULTIPLY
 * colour-grade rect, a 128 px film-grain TileSprite built from 2 300
 * `Phaser.Math.Between` calls at boot, zero-to-three tweened sun-shaft
 * ellipses, one-to-three tweened fog ellipses and a permanently transparent
 * lighting rect. Three of those were provably inert on every shipping location
 * (the grade pair is zeroed wherever a baked ToD variant exists — which is all
 * five — and the lighting rect's day alpha is 0), and the grain was
 * 1-screen-pixel noise over a 3-screen-pixel image: a fourth pixel density on
 * screen.
 *
 * FIVE TERMS, IN THIS ORDER (game-feel spec §1.2)
 *   1. grade    — a near-identity 16^3 LUT that carries LOCATION CHARACTER,
 *                 never time of day. The plates already have their hour baked
 *                 in by tools/forge/relight.cjs; a runtime grade strong enough
 *                 to change the hour is the double-grade bug returning.
 *   2. haze     — one drifting horizon band, replacing the fog ellipses.
 *   3. vignette — corner darkening AND edge AO, one falloff function.
 *   4. grain    — luma-only, quantised to the 3 px sprite grid, seed stepping
 *                 at 8 Hz so it reads as film rather than video noise.
 *   5. flash    — feedback (quest complete, dialogue dim). Positive mixes
 *                 toward the flash colour, negative darkens. Never
 *                 quality-scaled: it is game information, not decoration.
 *
 * Nothing in the shader is hardcoded scene data — every constant arrives as a
 * uniform from `core/postfxParams` and the location's own `visual` block.
 */

import Phaser from 'phaser';

export const MELAKA_POSTFX_KEY = 'MelakaPostFX';

const FRAG = `
#define SHADER_NAME MELAKA_POST_FX
precision mediump float;

uniform sampler2D uMainSampler;
uniform sampler2D uLutTex;
uniform float uLutWeight;

uniform float uVigStrength;
uniform float uVigPower;

uniform float uGrainAmt;
uniform float uGrainSeed;

uniform vec3  uHazeColour;
uniform float uHazeAmt;
uniform float uHazeY;
uniform float uHazeSpeed;

uniform vec4  uFlashColour;
uniform float uFlashAmt;

uniform float uTime;

varying vec2 outTexCoord;

/* 1. GRADE ---------------------------------------------------------------
 * 256x16 unwrapped 16^3 LUT: 16 slices of 16x16, blue advancing left to
 * right. Two hardware-bilinear samples plus a manual blue lerp — the r and g
 * axes stay inside their own slice because the sample x is clamped to the
 * [0.5, 15.5] texel-centre range within it, so bilinear never bleeds across a
 * slice seam. */
vec3 lutLookup(vec3 c)
{
    c = clamp(c, 0.0, 1.0);
    float b  = c.b * 15.0;
    float s0 = floor(b);
    float s1 = min(s0 + 1.0, 15.0);
    float f  = b - s0;
    float xr = c.r * 15.0 + 0.5;
    float y  = (c.g * 15.0 + 0.5) * 0.0625;
    vec3 c0 = texture2D(uLutTex, vec2((s0 * 16.0 + xr) * 0.00390625, y)).rgb;
    vec3 c1 = texture2D(uLutTex, vec2((s1 * 16.0 + xr) * 0.00390625, y)).rgb;
    return mix(c0, c1, f);
}

/* 4. GRAIN — one value per 3x3 screen block, i.e. per SPRITE pixel. */
float hash12(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

void main()
{
    vec4 texel = texture2D(uMainSampler, outTexCoord);
    vec3 c = texel.rgb;
    vec2 uv = outTexCoord;

    /* 1. grade */
    if (uLutWeight > 0.0)
    {
        c = mix(c, lutLookup(c), uLutWeight);
    }

    /* 2. horizon haze band — a soft, slowly drifting bank at uHazeY. */
    if (uHazeAmt > 0.0)
    {
        float drift = sin(uTime * uHazeSpeed * 0.35 + uv.x * 3.1) * 0.014
                    + sin(uTime * uHazeSpeed * 0.17 + uv.x * 1.3) * 0.010;
        float d = abs(uv.y - (uHazeY + drift));
        float band = 1.0 - smoothstep(0.0, 0.24, d);
        c = mix(c, uHazeColour, uHazeAmt * band);
    }

    /* 3. vignette + edge AO. Normalised so the extreme corner reads exactly
     *    uVigStrength; at uVigPower 2.4 an edge midpoint lands on 0.435 of it,
     *    which is the 0.42 ratio the old four-rect stack darkened by. */
    vec2 d2 = uv - 0.5;
    float r = length(d2) * 1.41421356;
    float vig = pow(clamp(r, 0.0, 1.0), uVigPower);
    c *= (1.0 - uVigStrength * vig);

    /* 4. grain */
    if (uGrainAmt > 0.0)
    {
        vec2 cell = floor(gl_FragCoord.xy * 0.3333333);
        float n = hash12(cell + vec2(uGrainSeed, uGrainSeed * 0.7));
        c += (n - 0.5) * uGrainAmt;
    }

    /* 5. feedback flash: positive mixes toward the flash colour, negative
     *    darkens (the dialogue/pause dim). */
    if (uFlashAmt > 0.0)
    {
        c = mix(c, uFlashColour.rgb, min(uFlashAmt, 1.0));
    }
    else if (uFlashAmt < 0.0)
    {
        c = mix(c, vec3(0.0), min(-uFlashAmt, 1.0));
    }

    gl_FragColor = vec4(clamp(c, 0.0, 1.0), texel.a);
}
`;

export interface MelakaPostFXConfig {
  lutKey: string | null;
  vigStrength: number;
  vigPower: number;
  grainAmt: number;
  hazeColour: number;
  hazeAmt: number;
  hazeY: number;
  hazeSpeed: number;
}

/** Split a 0xRRGGBB int into a normalised rgb triple. */
function rgbOf(colour: number): [number, number, number] {
  return [
    ((colour >> 16) & 0xff) / 255,
    ((colour >> 8) & 0xff) / 255,
    (colour & 0xff) / 255,
  ];
}

/** Neutral state, so a frame drawn before `configure()` is a pass-through. */
const IDLE: MelakaPostFXConfig = {
  lutKey: null,
  vigStrength: 0,
  vigPower: 2.4,
  grainAmt: 0,
  hazeColour: 0xFFFFFF,
  hazeAmt: 0,
  hazeY: 0.6,
  hazeSpeed: 0,
};

export class MelakaPostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  /**
   * ALL uniform state is held as plain fields and pushed in `onPreRender`.
   *
   * This is not a style choice. A `PostFXPipeline` boots LAZILY — Phaser calls
   * `bootFX()` on the first `postBatch`, and until then `currentShader` is
   * undefined, so any `set1f` from outside the render loop throws
   * "Cannot read properties of undefined (reading 'set1f')" and takes the whole
   * scene down with it. `AtmosphereSystem.create()` legitimately runs before
   * the first frame, so the setters below must never touch GL.
   */
  private params: MelakaPostFXConfig = IDLE;
  private flashColour: [number, number, number] = [1, 0.957, 0.831]; // sun-specular
  private flashAmt = 0;
  private timeSeconds = 0;
  private grainSeed = 0;

  constructor(game: Phaser.Game) {
    super({ game, name: MELAKA_POSTFX_KEY, fragShader: FRAG });
  }

  /** Everything that changes per location / per phase / per quality tier. */
  configure(config: MelakaPostFXConfig) {
    this.params = config;
  }

  /** Advance the clock and the 8 Hz grain seed. Called once per frame. */
  tick(timeMs: number, grainSeed: number) {
    this.timeSeconds = timeMs / 1000;
    this.grainSeed = grainSeed;
  }

  /**
   * Feedback flash. `amount` > 0 mixes toward `colour`; `amount` < 0 darkens.
   * The tween lives in the caller (AtmosphereSystem) so this stays a setter.
   */
  setFlash(amount: number, colour?: number) {
    this.flashAmt = amount;
    if (colour !== undefined) this.flashColour = rgbOf(colour);
  }

  getFlash(): number {
    return this.flashAmt;
  }

  onPreRender() {
    // `PostFXPipeline` boots lazily on its first `postBatch`, and the render
    // loop calls this hook before that has happened on frame one. Writing a
    // uniform through an undefined `currentShader` throws and takes the scene
    // down with it, so the first frame is deliberately a pass-through.
    if (!this.hasBooted || !this.currentShader) return;
    const c = this.params;
    const [hr, hg, hb] = rgbOf(c.hazeColour);
    this.set1f('uVigStrength', c.vigStrength);
    this.set1f('uVigPower', c.vigPower);
    this.set1f('uGrainAmt', c.grainAmt);
    this.set3f('uHazeColour', hr, hg, hb);
    this.set1f('uHazeAmt', c.hazeAmt);
    this.set1f('uHazeY', c.hazeY);
    this.set1f('uHazeSpeed', c.hazeSpeed);
    this.set1f('uTime', this.timeSeconds);
    this.set1f('uGrainSeed', this.grainSeed);
    this.set4f('uFlashColour', this.flashColour[0], this.flashColour[1], this.flashColour[2], 1);
    this.set1f('uFlashAmt', this.flashAmt);
    // The LUT lives on texture unit 1 (unit 0 is `uMainSampler`). A missing or
    // not-yet-decoded strip zeroes the weight, which makes the grade term a
    // no-op rather than a sample of a null texture: the scene degrades to
    // "ungraded", never to a black frame.
    this.set1i('uLutTex', 1);
    this.set1f('uLutWeight', this.lutGLTexture() ? 1 : 0);
  }

  /**
   * Bind the LUT to texture unit 1 before the quad is drawn.
   *
   * `bindAndDraw` re-activates unit 0 for `uMainSampler` on the way through, so
   * unit 1 stays exactly where we put it. A missing or not-yet-decoded LUT sets
   * `uLutWeight` to 0, which makes the grade term a no-op rather than sampling
   * a null texture — the scene degrades to "ungraded", never to a black frame.
   */
  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget) {
    const glTexture = this.lutGLTexture();
    if (glTexture) this.bindTexture(glTexture, 1);
    // The sampler binding and its weight go in AFTER `bind()`, which
    // `bindAndDraw` performs — before it, `currentShader` may not exist yet.
    this.bindAndDraw(renderTarget);
  }

  private lutGLTexture(): Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper | null {
    const key = this.params.lutKey;
    if (!key) return null;
    const textures = this.game.textures;
    if (!textures.exists(key)) return null;
    const source = textures.get(key).source[0];
    return (source?.glTexture as Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper) ?? null;
  }
}

/**
 * Register the pipeline on the renderer, once, idempotently.
 *
 * Called from `game.ts` on `ready` AND from `AtmosphereSystem.createLens()`:
 * the renderer's pipeline manager is booted at a slightly different moment
 * depending on how the game was constructed (React strict-mode remount, an
 * Electron cold start, a test harness), and a scene's `create()` is the one
 * point where it is guaranteed to exist. Returns true when the shader path is
 * available.
 */
export function ensureMelakaPostFX(game: Phaser.Game): boolean {
  if (game.renderer.type !== Phaser.WEBGL) return false;
  const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  const manager = renderer.pipelines as
    (Phaser.Renderer.WebGL.PipelineManager & { postPipelineClasses?: Map<string, unknown> })
    | undefined;
  if (!manager) return false;
  if (manager.postPipelineClasses?.has(MELAKA_POSTFX_KEY)) return true;
  try {
    manager.addPostPipeline(MELAKA_POSTFX_KEY, MelakaPostFX as unknown as Function);
    return true;
  } catch (error) {
    console.warn('[MelakaPostFX] registration failed:', error);
    return false;
  }
}

export default MelakaPostFX;
