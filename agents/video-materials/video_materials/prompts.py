"""The ≤2-minute script/caption/thumbnail prompt (Bahasa Indonesia, gaul).

Claude is used ONLY for the creative text. We hand it the deterministic picks
and demand strict JSON matching models.Brief, so generate.py can validate
without parsing prose. All human-facing copy (hook, segments, outro, caption,
thumbnail) is written in casual Indonesian slang using "lo"/"gue".
"""

from __future__ import annotations

import json

from .config import MAX_SECONDS, WORD_BUDGET
from .models import Pick
from .presenters import Presenter

# Shape we force Claude to return. Keep in lockstep with models.Brief.
OUTPUT_SHAPE = """{
  "title": "string — short, punchy episode title",
  "script": {
    "hook": "string — one-sentence opening that earns the next 2 minutes",
    "segments": [
      {
        "title": "string — the story headline, rephrased for spoken delivery",
        "narration": "string — ONE flowing spoken paragraph (NO bullet points, no lists, no dashes), like someone talking straight to camera",
        "seconds": 0
      }
    ],
    "outro": "string — call to action / sign-off",
    "total_words": 0,
    "est_seconds": 0
  },
  "caption": {
    "text": "string — social caption, 1-3 short sentences",
    "hashtags": ["#AINews", "..."]
  },
  "thumbnail": {
    "headline": "string — <= 6 words, all-caps friendly",
    "subtext": "string — <= 8 words supporting line"
  }
}"""


def build_prompt(picks: list[Pick], presenter: Presenter | None, n: int) -> str:
    picks_json = json.dumps(
        [
            {"title": p.title, "url": p.url, "source": p.source, "summary": p.summary}
            for p in picks
        ],
        indent=2,
        ensure_ascii=False,
    )

    # Target the full ~2-minute video regardless of story count.
    budget = int(WORD_BUDGET)
    one = n == 1

    story_line = (
        "Bahas SATU berita ini aja, tapi kupas sampai pas buat video 2 MENIT: "
        "jelasin beritanya, kasih konteks kenapa ini penting, terus tutup sama "
        "take/opini lo. Boleh ngembangin argumen & kasih contoh, tapi JANGAN "
        "ngarang fakta/angka/kutipan spesifik di luar ringkasan yang dikasih."
        if one
        else f"Bahas {n} berita ini, urut sesuai urutan."
    )
    structure_hint = (
        f"Isi 'segments' dengan TEPAT 1 segment. Hook ~20 kata, narration 1 "
        f"paragraf mengalir ~{budget - 45} kata, outro ~25 kata."
        if one
        else f"hook ~25, outro ~30, sisanya dibagi rata ke {n} berita ~20 detik tiap berita."
    )

    # Presenter is chosen later in the Record Video UI — the brief itself stays
    # presenter-neutral (no name, no @handle in the script or thumbnail).
    presenter_rule = (
        "PRESENTER — JANGAN sebut nama orang atau @handle siapa pun. Naskahnya "
        "NETRAL: presenter dipilih belakangan pas mau direkam. Tetap pakai 'gue' "
        "(buat diri sendiri) dan 'lo' (buat penonton), tapi tanpa nama."
    )

    return f"""Lo adalah penulis naskah yang bikin SHORT VIDEO VERTIKAL \
(TikTok/Reels/YouTube Shorts) berisi berita AI.

BAHASA — WAJIB: tulis SEMUA teks (hook, segments, outro, caption, thumbnail) dalam \
Bahasa Indonesia GAUL/santai, kayak ngobrol sama temen. WAJIB pakai kata ganti \
"lo" (buat penonton) dan "gue" (buat diri sendiri). Energik, asik, jangan kaku, \
jangan formal, jangan bahasa korporat. Boleh selipin istilah teknis Inggris yang \
emang umum (AI, startup, open-source, plugin, dll).

{presenter_rule}

DURASI — video full sekitar 2 MENIT. Budget kata sekitar {budget} kata total \
(≤ {MAX_SECONDS} detik di ~140 kata/menit). {structure_hint} Padat & nggak \
bertele-tele, tapi cukup buat ngisi 2 menit.

{story_line}

BERITA (JSON):
{picks_json}

PENTING — 'narration' tiap segment WAJIB berupa SATU paragraf yang ngalir, kayak \
orang lagi ngomong langsung ke kamera. DILARANG bikin bullet/poin-poin, list, atau \
tanda strip "-". Tulis kalimat nyambung satu sama lain. Thumbnail headline WAJIB \
Bahasa Indonesia, ≤6 kata, nampol, bikin orang berhenti scroll. Caption Bahasa \
Indonesia gaul + 3-6 hashtag relevan, tiap hashtag diawali '#'.

Set seconds tiap segment realistis (total semua seconds + hook + outro harus \
≤ {MAX_SECONDS}). Set total_words ke jumlah kata sebenarnya, dan est_seconds ke \
total_words / 140 * 60 dibulatkan.

Balikin HANYA satu objek JSON, tanpa markdown fence, tanpa komentar, persis sesuai \
bentuk ini (KUNCI tetap bahasa Inggris, ISI/value-nya Bahasa Indonesia gaul):
{OUTPUT_SHAPE}"""


def build_tighten_prompt(previous_json: str, est_seconds: float) -> str:
    """One-shot re-prompt when the first draft blows the 2-minute budget."""
    return f"""Naskah video ini kepanjangan: est_seconds={est_seconds:.0f}, padahal \
batas keras {MAX_SECONDS} detik (~{int(WORD_BUDGET)} kata).

Rampingin: buang basa-basi, perpendek talking_points, semua berita tetap ada tapi \
lebih padat. Pertahanin Bahasa Indonesia gaul ("lo"/"gue"). Hitung ulang \
total_words dan est_seconds dengan jujur (total_words / 140 * 60). Balikin HANYA \
objek JSON yang udah dibenerin, bentuk sama, tanpa komentar.

NASKAH SEKARANG:
{previous_json}"""
