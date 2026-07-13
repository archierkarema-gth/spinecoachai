/**
 * Display helpers for exercise equipment badges (docs/06). Title-cases raw
 * equipment strings and derives the badge list shown on a session card:
 * bodyweight moves (no equipment) get a single "Bodyweight" badge.
 */

/** Sentence-case an equipment string: only the first letter uppercased. */
export function equipmentLabel(item: string): string {
  return item.length > 0 ? item[0].toUpperCase() + item.slice(1) : item;
}

/** Badge labels for a move: ["Bodyweight"] if no equipment, else each item. */
export function equipmentBadges(equipment: string[]): string[] {
  if (equipment.length === 0) return ["Bodyweight"];
  return equipment.map(equipmentLabel);
}
