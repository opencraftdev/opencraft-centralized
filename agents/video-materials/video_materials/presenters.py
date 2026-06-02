"""Mirror of the web app's presenter list.

Keep in sync with
src/features/tutorial-video/presenters.ts — same ids/names/handles so a brief's
presenter resolves identically on both sides.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Presenter:
    id: str       # stable slug — stored in news_briefs.presenter_id
    name: str     # display name — news_briefs.presenter_name + thumbnail overlay
    handle: str   # @handle for the thumbnail overlay


PRESENTERS: list[Presenter] = [
    Presenter("rayandika", "Muhammad Rayandika", "@rayandikacode"),
    Presenter("depras", "Depras Nuryadi", "@Deprasny"),
    Presenter("rafi", "Muhammad Rafi Reyhan", "@mrafireyhan"),
]

DEFAULT_PRESENTER_ID = PRESENTERS[0].id


def get_presenter(presenter_id: str) -> Presenter:
    for p in PRESENTERS:
        if p.id == presenter_id:
            return p
    valid = ", ".join(p.id for p in PRESENTERS)
    raise ValueError(f"Unknown presenter '{presenter_id}'. Valid: {valid}")
