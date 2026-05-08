from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status

from .. import db
from ..schemas import (
    ActionItemRead,
    ActionItemSnippet,
    ExtractRequest,
    ExtractResponse,
    MarkDoneRequest,
    MarkDoneResponse,
)
from ..services.extract import extract_action_items, extract_action_items_llm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/action-items", tags=["action-items"])


@router.post("/extract", response_model=ExtractResponse)
def extract(payload: ExtractRequest) -> ExtractResponse:
    note_id: Optional[int] = None
    if payload.save_note:
        note_id = db.insert_note(payload.text)

    items = extract_action_items(payload.text)
    ids = db.insert_action_items(items, note_id=note_id)
    snippets = [ActionItemSnippet(id=i, text=t) for i, t in zip(ids, items)]
    return ExtractResponse(note_id=note_id, items=snippets)


@router.post(
    "/extract-llm",
    response_model=ExtractResponse,
    responses={
        status.HTTP_502_BAD_GATEWAY: {"description": "Local Ollama request failed or model error"},
    },
)
def extract_llm(payload: ExtractRequest) -> ExtractResponse:
    note_id: Optional[int] = None
    if payload.save_note:
        note_id = db.insert_note(payload.text)

    try:
        items = extract_action_items_llm(payload.text)
    except Exception:
        logger.exception("LLM extraction failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "LLM extraction failed. Ensure Ollama is running locally, the model exists "
                "(see OLLAMA_MODEL), and structured outputs are supported."
            ),
        ) from None

    ids = db.insert_action_items(items, note_id=note_id)
    snippets = [ActionItemSnippet(id=i, text=t) for i, t in zip(ids, items)]
    return ExtractResponse(note_id=note_id, items=snippets)


@router.get("", response_model=list[ActionItemRead])
def list_all(note_id: Optional[int] = None) -> list[ActionItemRead]:
    rows = db.list_action_items(note_id=note_id)
    return [
        ActionItemRead(
            id=r.id,
            note_id=r.note_id,
            text=r.text,
            done=r.done,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post(
    "/{action_item_id}/done",
    response_model=MarkDoneResponse,
    responses={status.HTTP_404_NOT_FOUND: {"description": "Unknown action item id"}},
)
def mark_done(action_item_id: int, payload: MarkDoneRequest) -> MarkDoneResponse:
    if not db.mark_action_item_done(action_item_id, payload.done):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="action item not found")
    return MarkDoneResponse(id=action_item_id, done=payload.done)
