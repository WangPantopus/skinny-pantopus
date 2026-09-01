"""Tests for topic-level (Jaccard) deduplication across recent posts."""

from __future__ import annotations

from unittest.mock import MagicMock

from src.pipeline.topic_dedup import (
    find_duplicate_topic,
    jaccard,
    load_recent_topics,
    normalize_title,
)


class TestNormalizeTitle:
    def test_strips_stopwords_and_punctuation(self):
        tokens = normalize_title("The new Council approves a bridge plan!")
        assert "council" in tokens
        assert "approves" in tokens
        assert "bridge" in tokens
        assert "plan" in tokens
        assert "the" not in tokens
        assert "new" not in tokens

    def test_case_insensitive(self):
        a = normalize_title("Blazers Beat Lakers Tonight")
        b = normalize_title("blazers beat lakers tonight")
        assert a == b

    def test_short_tokens_dropped(self):
        tokens = normalize_title("A B CD event center")
        assert "cd" not in tokens
        assert "event" in tokens
        assert "center" in tokens

    def test_body_tokens_included(self):
        tokens = normalize_title(
            "Short headline", body="Detailed story about a fairgrounds remodel project"
        )
        assert "fairgrounds" in tokens
        assert "remodel" in tokens
        assert "project" in tokens

    def test_body_is_truncated(self):
        long_body = "apple " * 500 + "banana"
        tokens = normalize_title("x", body=long_body)
        # "banana" appears well beyond the 400-char limit, should be dropped.
        assert "banana" not in tokens
        assert "apple" in tokens

    def test_empty_returns_empty(self):
        assert normalize_title("") == set()
        assert normalize_title(None) == set()


class TestJaccard:
    def test_identical_sets(self):
        assert jaccard({"a", "b"}, {"a", "b"}) == 1.0

    def test_disjoint_sets(self):
        assert jaccard({"a"}, {"b"}) == 0.0

    def test_partial_overlap(self):
        assert jaccard({"a", "b", "c"}, {"b", "c", "d"}) == 0.5

    def test_empty_returns_zero(self):
        assert jaccard(set(), {"a"}) == 0.0
        assert jaccard({"a"}, set()) == 0.0


class TestFindDuplicateTopic:
    def test_close_paraphrase_is_flagged(self):
        posted_title = "Clark County Council explores $30M remodel of event center"
        posted_body = (
            "The council is considering how to pay for major fairgrounds work "
            "including painting and parking lot repairs."
        )
        posted = [("id-1", normalize_title(posted_title, posted_body))]
        candidate_title = "Council weighs $30 million event center remodel"
        candidate_body = (
            "Clark County is considering fairgrounds work beyond painting and "
            "parking lot repairs, including major remodel plans."
        )
        match = find_duplicate_topic(
            candidate_title, posted, candidate_body=candidate_body
        )
        assert match is not None
        assert match[0] == "id-1"
        assert match[1] >= 0.5

    def test_unrelated_story_passes(self):
        posted_title = "Clark County Council explores event center remodel"
        posted_body = "The council debated funding for fairgrounds projects."
        posted = [("id-1", normalize_title(posted_title, posted_body))]
        candidate_title = "Vancouver fire department honors firefighters at ceremony"
        candidate_body = (
            "The annual Vancouver Fire Awards recognized acts of courage."
        )
        match = find_duplicate_topic(
            candidate_title, posted, candidate_body=candidate_body
        )
        assert match is None

    def test_best_match_returned(self):
        posted = [
            ("id-a", normalize_title(
                "Park ribbon cutting next Saturday",
                "The community will gather for the ribbon-cutting ceremony.",
            )),
            ("id-b", normalize_title(
                "Final bridge replacement impact report released",
                "The Interstate 5 Bridge replacement project reached a milestone.",
            )),
        ]
        candidate = "Final report on I-5 bridge replacement impacts released"
        body = "The Interstate 5 Bridge replacement project environmental report is out."
        match = find_duplicate_topic(candidate, posted, candidate_body=body)
        assert match is not None
        assert match[0] == "id-b"

    def test_short_candidate_never_matches(self):
        posted = [("id-1", normalize_title(
            "Blazers win thriller over Lakers tonight",
            "The home team pulled ahead in the fourth quarter.",
        ))]
        match = find_duplicate_topic("Blazers win", posted)
        assert match is None

    def test_threshold_is_respected(self):
        posted = [("id-1", normalize_title(
            "Timbers fall to Sounders in opener",
            "Portland dropped the season opener on the road.",
        ))]
        candidate = "Thorns beat Seattle Reign in home debut"
        body = "The women's side earned their first win of the season."
        assert find_duplicate_topic(candidate, posted, candidate_body=body) is None

    def test_related_but_distinct_stories_pass(self):
        """Two stories in the same topic area with different specifics shouldn't dedupe."""
        posted = [("id-1", normalize_title(
            "Council approves new library branch in east Vancouver",
            "The branch will serve Orchards neighborhood starting next spring.",
        ))]
        # Same broad area (council, approves, library) but different subject.
        candidate = "Council approves funding for downtown skate park"
        body = "Construction of the skate park begins this summer on Main Street."
        assert find_duplicate_topic(candidate, posted, candidate_body=body) is None

    def test_custom_threshold(self):
        """Callers can tighten or loosen the threshold for experimentation."""
        posted = [("id-1", normalize_title(
            "Council approves downtown skate park funding",
            "Construction begins this summer on Main Street.",
        ))]
        candidate = "Council approves library branch funding"
        body = "Construction begins next spring in east Vancouver."
        # Default 0.5 is too strict for this partial overlap.
        assert find_duplicate_topic(candidate, posted, candidate_body=body) is None
        # A relaxed threshold catches it — demonstrates the knob works.
        match = find_duplicate_topic(
            candidate, posted, candidate_body=body, threshold=0.25
        )
        assert match is not None
        assert match[0] == "id-1"


class TestLoadRecentTopics:
    def _mock_client(self, rows):
        client = MagicMock()
        execute = MagicMock()
        execute.data = rows
        (
            client.table.return_value
            .select.return_value
            .eq.return_value
            .in_.return_value
            .gte.return_value
            .limit.return_value
            .execute.return_value
        ) = execute
        return client

    def test_returns_normalized_tuples(self):
        client = self._mock_client([
            {
                "id": "1",
                "raw_title": "Council approves new library branch",
                "raw_body": "The vote happened Tuesday.",
            },
            {
                "id": "2",
                "raw_title": "Park ribbon cutting next Saturday downtown",
                "raw_body": "Community celebration planned.",
            },
        ])
        result = load_recent_topics(client, "clark_county")
        ids = [r[0] for r in result]
        assert ids == ["1", "2"]
        assert "library" in result[0][1]
        assert "ribbon" in result[1][1]

    def test_skips_rows_with_too_few_tokens(self):
        client = self._mock_client([
            {"id": "1", "raw_title": "Hello", "raw_body": None},
            {
                "id": "2",
                "raw_title": "Community garden opens Saturday downtown",
                "raw_body": "Volunteers broke ground last month.",
            },
        ])
        result = load_recent_topics(client, "clark_county")
        ids = [r[0] for r in result]
        assert ids == ["2"]

    def test_db_error_returns_empty(self):
        client = MagicMock()
        (
            client.table.return_value
            .select.return_value
            .eq.return_value
            .in_.return_value
            .gte.return_value
            .limit.return_value
            .execute.side_effect
        ) = Exception("boom")
        assert load_recent_topics(client, "clark_county") == []
