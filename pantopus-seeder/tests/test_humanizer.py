"""Tests for the humanizer pipeline stage."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from src.config.constants import MAX_HUMANIZED_LENGTH
from src.pipeline.humanizer import (
    SYSTEM_PROMPT,
    _build_system_prompt,
    _is_pnw_region,
    _validate_humanized_text,
    _validate_output,
    _validate_seasonal_timing,
    humanize,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_openai_response(text: str):
    """Create a mock OpenAI chat completion response."""
    message = MagicMock()
    message.content = text
    choice = MagicMock()
    choice.message = message
    response = MagicMock()
    response.choices = [choice]
    return response


def _call_humanize(texts):
    """Call humanize with a mock that returns the given texts in sequence."""
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [_mock_openai_response(t) for t in texts]

    with patch("src.pipeline.humanizer.openai") as mock_mod:
        mock_mod.OpenAI.return_value = mock_client
        result = humanize(
            raw_title="New park opens in Vancouver",
            raw_body="The city announced a new park.",
            source_url="https://example.com/article",
            source_display_name="The Columbian",
            category="local_news",
            region="clark_county",
            openai_api_key="test-key",
        )
    return result, mock_client


# ---------------------------------------------------------------------------
# _validate_output
# ---------------------------------------------------------------------------

class TestValidateOutput:
    def test_valid_output(self):
        text = "A new community park is opening on Main Street this Saturday. Source: The Columbian"
        assert _validate_output(text) is None

    def test_too_long(self):
        text = "x" * (MAX_HUMANIZED_LENGTH + 1)
        reason = _validate_output(text)
        assert reason is not None
        assert "too_long" in reason

    def test_exactly_max_length_passes(self):
        text = "x" * MAX_HUMANIZED_LENGTH
        assert _validate_output(text) is None

    def test_too_many_exclamations(self):
        text = "Great news! The park opens Saturday! Come visit!"
        reason = _validate_output(text)
        assert reason == "too_many_exclamations"

    def test_one_exclamation_ok(self):
        text = "The park opens Saturday! Source: The Columbian"
        assert _validate_output(text) is None

    def test_greeting_hey(self):
        assert _validate_output("Hey neighbors, check this out.") is not None
        assert "greeting" in _validate_output("Hey neighbors, check this out.")

    def test_greeting_hello(self):
        assert _validate_output("Hello everyone, new park opens.") is not None

    def test_greeting_good_morning(self):
        assert _validate_output("Good morning! Park opens today.") is not None

    def test_greeting_case_insensitive(self):
        assert _validate_output("HELLO everyone, park opens.") is not None

    def test_first_person_I_space(self):
        assert _validate_output("I think this park is great.") is not None
        assert "first_person" in _validate_output("I think this park is great.")

    def test_first_person_Im(self):
        assert _validate_output("I'm excited about the park opening.") is not None

    def test_first_person_Ive(self):
        assert _validate_output("I've heard the park opens Saturday.") is not None

    def test_first_person_curly_quote_Im(self):
        """Curly/smart apostrophe in I\u2019m should be caught."""
        assert _validate_output("I\u2019m excited about the park opening.") is not None
        assert "first_person" in _validate_output("I\u2019m excited about the park opening.")

    def test_first_person_curly_quote_Ive(self):
        """Curly/smart apostrophe in I\u2019ve should be caught."""
        assert _validate_output("I\u2019ve heard the park opens Saturday.") is not None

    def test_first_person_curly_quote_Id(self):
        """Curly/smart apostrophe in I\u2019d should be caught."""
        assert _validate_output("I\u2019d recommend visiting the new park.") is not None

    def test_greeting_hi(self):
        assert _validate_output("Hi everyone, new park opens.") is not None
        assert "greeting" in _validate_output("Hi everyone, new park opens.")

    def test_greeting_hey_no_false_positive(self):
        """'Heyward Park' should NOT trigger the greeting filter."""
        assert _validate_output("Heyward Park opens Saturday. Source: Test") is None

    def test_first_person_mid_sentence(self):
        assert _validate_output("The park that I think is great. Source: Test") is not None

    def test_AQI_does_not_trigger(self):
        text = "AQI levels are expected to reach 150 this weekend. Source: AQMD"
        assert _validate_output(text) is None

    def test_AI_does_not_trigger(self):
        text = "The city is using AI to manage traffic. Source: City of Portland"
        assert _validate_output(text) is None


class TestSeasonalTimingValidation:
    def test_rejects_early_march_after_window_passed(self):
        text = "Clearing gutters early in March can prevent basement leaks. Source: Pantopus Seasonal"
        reason = _validate_seasonal_timing(text, today=date(2026, 4, 20))
        assert reason is not None
        assert reason.startswith("stale_calendar_window")

    def test_allows_early_march_during_window(self):
        text = "Clearing gutters early March can prevent basement leaks. Source: Pantopus Seasonal"
        assert _validate_seasonal_timing(text, today=date(2026, 3, 5)) is None

    def test_allows_month_range_that_includes_current_month(self):
        text = "Yard debris pickup runs in March and April. Source: Pantopus Seasonal"
        assert _validate_seasonal_timing(text, today=date(2026, 4, 20)) is None

    def test_rejects_month_range_after_it_passes(self):
        text = "Yard debris pickup runs in March and April. Source: Pantopus Seasonal"
        assert _validate_seasonal_timing(text, today=date(2026, 5, 1)) == "stale_calendar_month"

    def test_rejects_before_current_month(self):
        text = "Weatherstripping before November helps with heating bills. Source: Pantopus Seasonal"
        reason = _validate_seasonal_timing(text, today=date(2026, 11, 2))
        assert reason is not None
        assert reason.startswith("stale_calendar_window")

    def test_non_seasonal_category_skips_timing_check(self):
        text = "The March council meeting notes were released today. Source: City"
        assert _validate_humanized_text(text, "local_news", today=date(2026, 4, 20)) is None


# ---------------------------------------------------------------------------
# humanize function
# ---------------------------------------------------------------------------

class TestHumanize:
    def test_successful_humanization(self):
        good_text = "A new park opens on Main Street this Saturday at 10am. Source: The Columbian \u2014 https://example.com/article"
        result, client = _call_humanize([good_text])
        text, error = result
        assert text == good_text
        assert error is None

    def test_stale_seasonal_source_skips_before_openai_call(self):
        class FakeDate(date):
            @classmethod
            def today(cls):
                return cls(2026, 4, 20)

        with (
            patch("src.pipeline.humanizer.date", FakeDate),
            patch("src.pipeline.humanizer.openai") as mock_mod,
        ):
            text, error = humanize(
                raw_title=(
                    "Gutters packed with winter debris cause basement leaks during spring rain. "
                    "Flushing them in early March saves a lot of headaches later."
                ),
                raw_body=None,
                source_url=None,
                source_display_name="Pantopus Seasonal",
                category="seasonal",
                region="clark_county",
                openai_api_key="key",
            )

        assert text is None
        assert error == "ai_quality_gate:skipped"
        mock_mod.OpenAI.assert_not_called()

    def test_stale_exact_source_window_skips_even_with_current_month_reference(self):
        class FakeDate(date):
            @classmethod
            def today(cls):
                return cls(2026, 11, 2)

        with (
            patch("src.pipeline.humanizer.date", FakeDate),
            patch("src.pipeline.humanizer.openai") as mock_mod,
        ):
            text, error = humanize(
                raw_title=(
                    "Roof inspections are easiest in dry October weather. Missing or cracked shingles "
                    "caught now won't become leaks during November rain."
                ),
                raw_body=None,
                source_url=None,
                source_display_name="Pantopus Seasonal",
                category="seasonal",
                region="clark_county",
                openai_api_key="key",
            )

        assert text is None
        assert error == "ai_quality_gate:skipped"
        mock_mod.OpenAI.assert_not_called()

    def test_retry_on_too_long(self):
        long_text = "x" * 501
        short_text = "A new park opens Saturday. Source: The Columbian"
        result, client = _call_humanize([long_text, short_text])
        text, error = result
        assert text == short_text
        assert error is None
        assert client.chat.completions.create.call_count == 2

    def test_retry_on_exclamation(self):
        bad = "Wow! Amazing! The park opens Saturday!"
        good = "The park opens Saturday. Source: The Columbian"
        result, client = _call_humanize([bad, good])
        text, error = result
        assert text == good
        assert error is None

    def test_retry_on_greeting(self):
        bad = "Hey neighbors, a new park is opening."
        good = "A new park is opening on Main Street. Source: The Columbian"
        result, client = _call_humanize([bad, good])
        text, error = result
        assert text == good
        assert error is None

    def test_retry_on_first_person(self):
        bad = "I think the new park is a great addition to Vancouver."
        good = "A new park is set to open on Main Street. Source: The Columbian"
        result, client = _call_humanize([bad, good])
        text, error = result
        assert text == good
        assert error is None

    def test_failed_retry_returns_validation_failed(self):
        bad1 = "x" * 501
        bad2 = "y" * 501
        result, client = _call_humanize([bad1, bad2])
        text, error = result
        assert text is None
        assert error.startswith("validation_failed:")

    def test_api_error_returns_none(self):
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = Exception("Rate limited")

        with patch("src.pipeline.humanizer.openai") as mock_mod:
            mock_mod.OpenAI.return_value = mock_client
            text, error = humanize(
                raw_title="Test",
                raw_body=None,
                source_url=None,
                source_display_name="Test Source",
                category="local_news",
                region="clark_county",
                openai_api_key="test-key",
            )
        assert text is None
        assert error.startswith("api_error:")

    def test_system_prompt_sent_as_system_message(self):
        good = "Park opens Saturday. Source: The Columbian"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(good)

        with patch("src.pipeline.humanizer.openai") as mock_mod:
            mock_mod.OpenAI.return_value = mock_client
            humanize(
                raw_title="Test",
                raw_body=None,
                source_url=None,
                source_display_name="Test",
                category="local_news",
                region="clark_county",
                openai_api_key="key",
            )

        call_kwargs = mock_client.chat.completions.create.call_args
        messages = call_kwargs.kwargs["messages"]
        assert messages[0]["role"] == "system"
        assert messages[0]["content"] == SYSTEM_PROMPT

    def test_system_prompt_uses_region_display_name(self):
        good = "Park opens Saturday. Source: The Columbian"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(good)

        with patch("src.pipeline.humanizer.openai") as mock_mod:
            mock_mod.OpenAI.return_value = mock_client
            humanize(
                raw_title="Test",
                raw_body=None,
                source_url=None,
                source_display_name="Test",
                category="local_news",
                region="denver_co",
                openai_api_key="key",
                region_display_name="Denver, CO",
            )

        call_kwargs = mock_client.chat.completions.create.call_args
        messages = call_kwargs.kwargs["messages"]
        system = messages[0]["content"]
        assert "Denver, CO" in system
        assert "a local community" not in system

    def test_user_message_includes_required_fields(self):
        good = "Park opens Saturday. Source: The Columbian"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(good)

        with patch("src.pipeline.humanizer.openai") as mock_mod:
            mock_mod.OpenAI.return_value = mock_client
            humanize(
                raw_title="New park opens",
                raw_body="Body text here",
                source_url="https://example.com",
                source_display_name="The Columbian",
                category="event",
                region="portland_metro",
                openai_api_key="key",
                region_display_name="Portland Metro",
            )

        call_kwargs = mock_client.chat.completions.create.call_args
        # User message is the second message (after system)
        user_msg = call_kwargs.kwargs["messages"][1]["content"]
        assert "event" in user_msg
        assert "Portland Metro" in user_msg
        assert "New park opens" in user_msg
        assert "season" in user_msg.lower()
        assert "date" in user_msg.lower()

    def test_pnw_region_includes_season(self):
        """PNW regions should have seasonal context in the user message."""
        good = "Park opens Saturday. Source: The Columbian"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(good)

        with patch("src.pipeline.humanizer.openai") as mock_mod:
            mock_mod.OpenAI.return_value = mock_client
            humanize(
                raw_title="Test", raw_body=None, source_url=None,
                source_display_name="Test", category="local_news",
                region="seattle_wa", openai_api_key="key",
            )

        user_msg = mock_client.chat.completions.create.call_args.kwargs["messages"][1]["content"]
        assert "PNW season" in user_msg

    def test_non_pnw_region_omits_season(self):
        """Non-PNW regions should not have PNW seasonal context."""
        good = "Park opens Saturday. Source: Test"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(good)

        with patch("src.pipeline.humanizer.openai") as mock_mod:
            mock_mod.OpenAI.return_value = mock_client
            humanize(
                raw_title="Test", raw_body=None, source_url=None,
                source_display_name="Test", category="local_news",
                region="denver_co", openai_api_key="key",
            )

        user_msg = mock_client.chat.completions.create.call_args.kwargs["messages"][1]["content"]
        assert "PNW season" not in user_msg

    def test_openai_not_installed(self):
        """If openai module is None, humanize returns api_error."""
        with patch("src.pipeline.humanizer.openai", None):
            text, error = humanize(
                raw_title="Test",
                raw_body=None,
                source_url=None,
                source_display_name="Test",
                category="local_news",
                region="clark_county",
                openai_api_key="key",
            )
        assert text is None
        assert "not installed" in error


# ---------------------------------------------------------------------------
# _build_system_prompt
# ---------------------------------------------------------------------------

class TestBuildSystemPrompt:
    def test_default_prompt(self):
        prompt = _build_system_prompt()
        assert "a local community" in prompt

    def test_with_region_name(self):
        prompt = _build_system_prompt("Seattle, WA")
        assert "Seattle, WA" in prompt
        assert "a local community" not in prompt

    def test_empty_string_uses_default(self):
        prompt = _build_system_prompt("")
        assert "a local community" in prompt


# ---------------------------------------------------------------------------
# _is_pnw_region
# ---------------------------------------------------------------------------

class TestIsPnwRegion:
    def test_portland_metro(self):
        assert _is_pnw_region("portland_metro") is True

    def test_seattle_wa(self):
        assert _is_pnw_region("seattle_wa") is True

    def test_clark_county(self):
        # clark_county doesn't have PNW keywords, but that's fine —
        # it will fall through to no season, which is acceptable
        assert _is_pnw_region("clark_county") is False

    def test_denver_co(self):
        assert _is_pnw_region("denver_co") is False

    def test_bend_or(self):
        assert _is_pnw_region("bend_or") is True

    def test_eugene_or(self):
        assert _is_pnw_region("eugene_or") is True
