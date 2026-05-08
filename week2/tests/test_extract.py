import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from ..app.services.extract import extract_action_items, extract_action_items_llm


def _ollama_chat_response(items: list[str], content: str | None = None) -> SimpleNamespace:
    """Build a minimal object matching ollama chat() return shape."""
    if content is None:
        content = json.dumps({"items": items})
    return SimpleNamespace(message=SimpleNamespace(content=content))


def test_extract_bullets_and_checkboxes():
    text = """
    Notes from meeting:
    - [ ] Set up database
    * implement API extract endpoint
    1. Write tests
    Some narrative sentence.
    """.strip()

    items = extract_action_items(text)
    assert "Set up database" in items
    assert "implement API extract endpoint" in items
    assert "Write tests" in items


@pytest.mark.parametrize(
    "text",
    ["", "   ", "\n\t\n", "  \r\n  "],
)
def test_extract_llm_empty_or_whitespace_returns_empty_without_calling_ollama(text):
    with patch("week2.app.services.extract.chat") as mock_chat:
        assert extract_action_items_llm(text) == []
        mock_chat.assert_not_called()


@patch("week2.app.services.extract.chat")
def test_extract_llm_bullet_list(mock_chat):
    mock_chat.return_value = _ollama_chat_response(
        ["Set up database", "Implement API extract endpoint", "Write tests"]
    )
    text = """
    Notes:
    - [ ] Set up database
    * implement API extract endpoint
    1. Write tests
    """.strip()

    items = extract_action_items_llm(text)
    assert items == [
        "Set up database",
        "Implement API extract endpoint",
        "Write tests",
    ]
    mock_chat.assert_called_once()
    call_kwargs = mock_chat.call_args.kwargs
    assert call_kwargs["model"]
    assert call_kwargs["options"] == {"temperature": 0}
    assert call_kwargs["messages"][0]["role"] == "system"
    assert call_kwargs["messages"][1]["role"] == "user"
    assert text in call_kwargs["messages"][1]["content"]


@patch("week2.app.services.extract.chat")
def test_extract_llm_keyword_prefixed_lines(mock_chat):
    mock_chat.return_value = _ollama_chat_response(
        ["Review pull request", "Ship milestone one", "Book design review"]
    )
    text = """
    todo: Review pull request
    Action: Ship milestone one
    next: Book design review
    """.strip()

    items = extract_action_items_llm(text)
    assert len(items) == 3
    assert "Review pull request" in items
    assert "Ship milestone one" in items
    assert "Book design review" in items


@patch("week2.app.services.extract.chat")
def test_extract_llm_deduplicates_case_insensitively(mock_chat):
    mock_chat.return_value = _ollama_chat_response(
        ["Same task", "SAME TASK", "same task", "Unique task"]
    )
    items = extract_action_items_llm("some note")
    assert items == ["Same task", "Unique task"]


@patch("week2.app.services.extract.chat")
def test_extract_llm_strips_and_skips_empty_strings(mock_chat):
    mock_chat.return_value = _ollama_chat_response(
        ["  Real item  ", "", "   ", "Another real item"]
    )
    items = extract_action_items_llm("note")
    assert items == ["Real item", "Another real item"]


@patch("week2.app.services.extract.chat")
def test_extract_llm_empty_model_message_returns_empty(mock_chat):
    mock_chat.return_value = _ollama_chat_response([], content="")
    assert extract_action_items_llm("non-empty note") == []


@patch("week2.app.services.extract.chat")
def test_extract_llm_system_prompt_instructs_cleanup(mock_chat):
    mock_chat.return_value = _ollama_chat_response(["One thing"])
    extract_action_items_llm("anything")
    messages = mock_chat.call_args.kwargs["messages"]
    system_text = messages[0]["content"]
    assert "unnecessary numbers" in system_text.lower()
    assert "unnecessary punctuation" in system_text.lower()
