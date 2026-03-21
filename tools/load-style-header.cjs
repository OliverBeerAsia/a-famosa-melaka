/**
 * Centralized style header loader for AI generation tools.
 *
 * Reads the canonical style prefix from prompts.json and
 * appends asset-class constraints from gameplay-asset-spec.json.
 */

const fs = require('fs');
const path = require('path');

const PROMPTS_PATH = path.join(__dirname, 'ai-prompts', 'prompts.json');
const SPEC_PATH = path.join(__dirname, '..', 'docs', 'art-bible', 'gameplay-asset-spec.json');

let _prompts;
let _spec;

function loadPrompts() {
  if (!_prompts) _prompts = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));
  return _prompts;
}

function loadSpec() {
  if (!_spec) _spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
  return _spec;
}

function getBannedAnchors() {
  return loadSpec().bannedStyleAnchors || [];
}

/**
 * Return the canonical style prefix, optionally enriched with
 * profile-specific constraints for the given assetClass.
 *
 * @param {string} [assetClass] - key into styleProfiles (e.g. "portrait", "scene-backdrop")
 * @returns {string}
 */
function getStyleHeader(assetClass) {
  const style = loadPrompts().style;
  const spec = loadSpec();
  let header = style;

  if (assetClass && spec.styleProfiles && spec.styleProfiles[assetClass]) {
    const profile = spec.styleProfiles[assetClass];
    const constraints = Object.entries(profile)
      .filter(([k]) => k !== 'validationThresholds')
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');
    header += `\nASSET-CLASS CONSTRAINTS (${assetClass}):\n${constraints}\n`;
  }

  // Self-check: strip negation context then scan for banned anchors
  const negationBlockRe = /BANNED TECHNIQUES[:\s\S]*?(?=\n\n|\n[A-Z]|$)/gi;
  const negationLineRe = /^.*\b(NO|not|without|forbidden|never)\b.*$/gim;
  const stripped = header.replace(negationBlockRe, '').replace(negationLineRe, '');

  const banned = getBannedAnchors();
  for (const anchor of banned) {
    if (stripped.toLowerCase().includes(anchor.toLowerCase())) {
      throw new Error(
        `Style header self-check failed: banned anchor "${anchor}" found outside negation context`
      );
    }
  }

  return header;
}

module.exports = { getStyleHeader, getBannedAnchors };
