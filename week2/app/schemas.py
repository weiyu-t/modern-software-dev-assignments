from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ExtractRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    text: str = Field(..., min_length=1, description="Raw notes to scan for action items.")
    save_note: bool = Field(default=False, description="If true, persist the note before extracting.")


class ActionItemSnippet(BaseModel):
    """Single extracted item returned from the extract endpoint (id assigned after insert)."""

    id: int
    text: str


class ExtractResponse(BaseModel):
    note_id: int | None = None
    items: list[ActionItemSnippet]


class ActionItemRead(BaseModel):
    id: int
    note_id: int | None
    text: str
    done: bool
    created_at: str


class MarkDoneRequest(BaseModel):
    done: bool = True


class MarkDoneResponse(BaseModel):
    id: int
    done: bool


class NoteCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    content: str = Field(..., min_length=1)


class NoteRead(BaseModel):
    id: int
    content: str
    created_at: str
