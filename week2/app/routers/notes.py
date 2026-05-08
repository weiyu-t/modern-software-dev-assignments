from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from .. import db
from ..schemas import NoteCreate, NoteRead

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("", response_model=list[NoteRead])
def list_notes() -> list[NoteRead]:
    """Return every note, newest ids first."""
    rows = db.list_notes()
    return [NoteRead(id=n.id, content=n.content, created_at=n.created_at) for n in rows]


@router.post("", response_model=NoteRead)
def create_note(payload: NoteCreate) -> NoteRead:
    note_id = db.insert_note(payload.content)
    note = db.get_note(note_id)
    if note is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="note could not be loaded after insert",
        )
    return NoteRead(id=note.id, content=note.content, created_at=note.created_at)


@router.get(
    "/{note_id}",
    response_model=NoteRead,
    responses={status.HTTP_404_NOT_FOUND: {"description": "Note not found"}},
)
def get_single_note(note_id: int) -> NoteRead:
    note = db.get_note(note_id)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="note not found")
    return NoteRead(id=note.id, content=note.content, created_at=note.created_at)
