from __future__ import annotations

import re
from typing import List

from dotenv import load_dotenv
from ollama import chat
from pydantic import BaseModel, Field

from ..config import get_settings

load_dotenv()

BULLET_PREFIX_PATTERN = re.compile(r"^\s*([-*•]|\d+\.)\s+")
KEYWORD_PREFIXES = (
    "todo:",
    "action:",
    "next:",
)


def _is_action_line(line: str) -> bool:
    stripped = line.strip().lower()
    if not stripped:
        return False
    if BULLET_PREFIX_PATTERN.match(stripped):
        return True
    if any(stripped.startswith(prefix) for prefix in KEYWORD_PREFIXES):
        return True
    if "[ ]" in stripped or "[todo]" in stripped:
        return True
    return False


def extract_action_items(text: str) -> List[str]:
    lines = text.splitlines()
    extracted: List[str] = []
    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        if _is_action_line(line):
            cleaned = BULLET_PREFIX_PATTERN.sub("", line)
            cleaned = cleaned.strip()
            # Trim common checkbox markers
            cleaned = cleaned.removeprefix("[ ]").strip()
            cleaned = cleaned.removeprefix("[todo]").strip()
            extracted.append(cleaned)
    # Fallback: if nothing matched, heuristically split into sentences and pick imperative-like ones
    if not extracted:
        sentences = re.split(r"(?<=[.!?])\s+", text.strip())
        for sentence in sentences:
            s = sentence.strip()
            if not s:
                continue
            if _looks_imperative(s):
                extracted.append(s)
    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: List[str] = []
    for item in extracted:
        lowered = item.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        unique.append(item)
    return unique


def _looks_imperative(sentence: str) -> bool:
    words = re.findall(r"[A-Za-z']+", sentence)
    if not words:
        return False
    first = words[0]
    # Crude heuristic: treat these as imperative starters
    imperative_starters = {
        "add",
        "create",
        "implement",
        "fix",
        "update",
        "write",
        "check",
        "verify",
        "refactor",
        "document",
        "design",
        "investigate",
    }
    return first.lower() in imperative_starters


# --- Exercise 1: LLM-powered extraction (scaffold; same I/O as ``extract_action_items``) ---


class _ActionItemsLLMResponse(BaseModel):
    """Structured JSON shape returned by Ollama (see https://ollama.com/blog/structured-outputs)."""

    items: List[str] = Field(default_factory=list)


_SYSTEM_PROMPT_EXTRACT_LLM = (
    "You extract concrete action items from notes, meeting minutes, and task-like text. "
    "Each item must be a single clear, actionable task. "
    "Remove unnecessary numbers and unnecessary punctuation from each returned item "
    "(keep wording natural and readable). "
    "Do not include bullet symbols, numeric list prefixes, checkboxes, or labels like TODO in the strings."
)


def extract_action_items_llm(text: str) -> List[str]:
    """Extract action items using a local Ollama model; returns the same type as ``extract_action_items``."""
    stripped = text.strip()
    if not stripped:
        return []

    response = chat(
        model=get_settings().ollama_model,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT_EXTRACT_LLM},
            {"role": "user", "content": stripped},
        ],
        format=_ActionItemsLLMResponse.model_json_schema(),
        options={"temperature": 0},
    )
    raw = response.message.content
    if not raw:
        return []

    parsed = _ActionItemsLLMResponse.model_validate_json(raw)
    seen: set[str] = set()
    out: List[str] = []
    for item in parsed.items:
        cleaned = item.strip()
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(cleaned)
    return out
