# A Famosa — Lighting Standard

## Primary Light Source
- **Direction**: North-west (top-left diagonal at 135°)
- **Colour**: Warm white, slightly amber-tinted (#F8F0E0)
- All tiles, backgrounds, and sprites must be lit from the NW
- Lightest face = NW-facing surfaces
- Deepest shadow = SE-facing surfaces

## Secondary Warm Bounce
- Day scenes: subtle warm amber bounce from the south (ground reflection)
- Colour: (#C87040 at ~20% opacity blend)
- Simulates tropical light bouncing off laterite stone and sand

## Time of Day

| TOD   | Sky Colour       | Shadow Colour    | Key Light       | Notes                          |
|-------|-----------------|-----------------|-----------------|--------------------------------|
| Dawn  | #F08840 → #C0D8F0 | #402010       | Warm orange     | Long NW→SE shadows              |
| Day   | #80C0F0         | #302010          | Bright neutral  | Crisp, high-contrast           |
| Dusk  | #E06020 → #601820 | #301040       | Deep amber-red  | Soft fill from east            |
| Night | #101828         | #080810          | Multiple points | Lanterns #F0C050, Moon #A0B8D0 |

## Night Scene Rules
- NO simple dark-filter night variants — each must be a genuine repaint
- Multiple point light sources (lanterns, torches, cooking fires, moonlight)
- Each light source: warm amber pool (#F0C050 → #E07020) fading to cool violet shadow (#181830)
- Lantern pool radius: approximately 32–48 game pixels
- Between light sources: near-black with subtle violet-blue (#181830)
- Moon highlights: silver-blue (#A0B8D0) on upward-facing surfaces

## Enforcement
All submitted art must:
1. Reference the master-palette.png — no colours outside the 48-colour set
2. Pass the NW light direction check (light source angle 315°)
3. Show visible shadow on SE faces of all raised objects
4. Night variants must show at least 2 distinct light sources per scene
