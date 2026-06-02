// Single source of truth for who can appear on a tutorial's opening overlay.
// To add a presenter, add one line here — the dropdown, the render overlay, and
// the grouped history all read from this list. Nothing else needs to change.
export interface Presenter {
  id: string; // stable slug — stored/sent, never shown
  name: string; // overlay line 1 + history group key
  handle: string; // overlay line 2 (@handle)
}

export const PRESENTERS: Presenter[] = [
  { id: "rayandika", name: "Muhammad Rayandika", handle: "@rayandikacode" },
  { id: "depras", name: "Depras Nuryadi", handle: "@Deprasny" },
  { id: "rafi", name: "Muhammad Rafi Reyhan", handle: "@mrafireyhan" },
];

export const DEFAULT_PRESENTER_ID = PRESENTERS[0].id;

export function getPresenter(id: string): Presenter | undefined {
  return PRESENTERS.find((p) => p.id === id);
}

// History rows store the display name; this resolves the handle back for display
// and lets us order groups by the canonical PRESENTERS order.
export function getPresenterByName(name: string): Presenter | undefined {
  return PRESENTERS.find((p) => p.name === name);
}
