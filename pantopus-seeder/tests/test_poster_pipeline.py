"""Tests for the poster pipeline module (auth + API client)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from src.config.constants import ALL_CATEGORIES, CATEGORY_TO_POST_TYPE, CATEGORY_TO_PURPOSE
from src.pipeline.poster import authenticate_curator, post_to_pantopus


# ---------------------------------------------------------------------------
# authenticate_curator
# ---------------------------------------------------------------------------

class TestAuthenticateCurator:
    def test_successful_sign_in(self):
        sb = MagicMock()
        session = MagicMock()
        session.access_token = "test-token-123"
        sb.auth.sign_in_with_password.return_value = MagicMock(session=session)

        token = authenticate_curator(sb, "curator@test.com", "password")
        assert token == "test-token-123"

    def test_failed_sign_in_returns_none(self):
        sb = MagicMock()
        sb.auth.sign_in_with_password.side_effect = Exception("Invalid credentials")

        token = authenticate_curator(sb, "curator@test.com", "wrong")
        assert token is None

    def test_network_error_returns_none(self):
        sb = MagicMock()
        sb.auth.sign_in_with_password.side_effect = ConnectionError("Timeout")

        token = authenticate_curator(sb, "curator@test.com", "password")
        assert token is None

    def test_passes_correct_credentials(self):
        sb = MagicMock()
        session = MagicMock()
        session.access_token = "tok"
        sb.auth.sign_in_with_password.return_value = MagicMock(session=session)

        authenticate_curator(sb, "user@example.com", "secret123")
        sb.auth.sign_in_with_password.assert_called_once_with({
            "email": "user@example.com",
            "password": "secret123",
        })


# ---------------------------------------------------------------------------
# post_to_pantopus
# ---------------------------------------------------------------------------

def _mock_response(status_code=201, json_data=None, text=""):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data or {}
    resp.text = text
    return resp


class TestPostToPantopus:
    @patch("src.pipeline.poster.httpx.post")
    def test_successful_post(self, mock_post):
        mock_post.return_value = _mock_response(201, {"post": {"id": "uuid-123"}})

        post_id, error = post_to_pantopus(
            api_base_url="https://api.pantopus.com",
            access_token="token",
            content="A new park opens Saturday.",
            category="local_news",
            region_lat=45.6387,
            region_lng=-122.6615,
        )
        assert post_id == "uuid-123"
        assert error is None

    @patch("src.pipeline.poster.httpx.post")
    def test_successful_post_flat_id(self, mock_post):
        """Handle {id: ...} response pattern."""
        mock_post.return_value = _mock_response(201, {"id": "flat-uuid"})

        post_id, error = post_to_pantopus(
            api_base_url="https://api.pantopus.com",
            access_token="token",
            content="Test content",
            category="event",
            region_lat=45.6387,
            region_lng=-122.6615,
        )
        assert post_id == "flat-uuid"
        assert error is None

    @patch("src.pipeline.poster.httpx.post")
    def test_400_returns_api_rejected(self, mock_post):
        mock_post.return_value = _mock_response(400, text='{"error":"bad request"}')

        post_id, error = post_to_pantopus(
            api_base_url="https://api.pantopus.com",
            access_token="token",
            content="Test",
            category="local_news",
            region_lat=45.0,
            region_lng=-122.0,
        )
        assert post_id is None
        assert error.startswith("api_rejected:400:")

    @patch("src.pipeline.poster.httpx.post")
    def test_500_returns_server_error(self, mock_post):
        mock_post.return_value = _mock_response(500, text="Internal Server Error")

        post_id, error = post_to_pantopus(
            api_base_url="https://api.pantopus.com",
            access_token="token",
            content="Test",
            category="local_news",
            region_lat=45.0,
            region_lng=-122.0,
        )
        assert post_id is None
        assert error == "api_server_error:500"

    @patch("src.pipeline.poster.httpx.post")
    def test_timeout_returns_network_error(self, mock_post):
        mock_post.side_effect = Exception("Connection timed out")

        post_id, error = post_to_pantopus(
            api_base_url="https://api.pantopus.com",
            access_token="token",
            content="Test",
            category="local_news",
            region_lat=45.0,
            region_lng=-122.0,
        )
        assert post_id is None
        assert error.startswith("network_error:")

    @patch("src.pipeline.poster.httpx.post")
    def test_correct_category_mapping(self, mock_post):
        """Each category maps to the correct postType and purpose."""
        mock_post.return_value = _mock_response(201, {"post": {"id": "test"}})

        for category in CATEGORY_TO_POST_TYPE:
            post_to_pantopus(
                api_base_url="https://api.pantopus.com",
                access_token="token",
                content="Test",
                category=category,
                region_lat=45.0,
                region_lng=-122.0,
            )

            call_kwargs = mock_post.call_args
            body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
            assert body["postType"] == CATEGORY_TO_POST_TYPE[category], (
                f"Wrong postType for {category}"
            )
            assert body["purpose"] == CATEGORY_TO_PURPOSE[category], (
                f"Wrong purpose for {category}"
            )

    @patch("src.pipeline.poster.httpx.post")
    def test_authorization_header(self, mock_post):
        mock_post.return_value = _mock_response(201, {"post": {"id": "test"}})

        post_to_pantopus(
            api_base_url="https://api.pantopus.com",
            access_token="my-secret-token",
            content="Test",
            category="local_news",
            region_lat=45.0,
            region_lng=-122.0,
        )

        call_kwargs = mock_post.call_args
        headers = call_kwargs.kwargs.get("headers") or call_kwargs[1].get("headers")
        assert headers["Authorization"] == "Bearer my-secret-token"

    @patch("src.pipeline.poster.httpx.post")
    def test_request_body_fields(self, mock_post):
        mock_post.return_value = _mock_response(201, {"post": {"id": "test"}})

        post_to_pantopus(
            api_base_url="https://api.pantopus.com",
            access_token="token",
            content="Park opens Saturday. Source: The Columbian",
            category="event",
            region_lat=45.5152,
            region_lng=-122.6784,
        )

        call_kwargs = mock_post.call_args
        body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
        assert body["content"] == "Park opens Saturday. Source: The Columbian"
        assert body["visibility"] == "public"
        assert body["latitude"] == 45.5152
        assert body["longitude"] == -122.6784
        assert "postType" in body
        assert "purpose" in body

    @patch("src.pipeline.poster.httpx.post")
    def test_url_construction(self, mock_post):
        mock_post.return_value = _mock_response(201, {"post": {"id": "test"}})

        post_to_pantopus(
            api_base_url="https://api.pantopus.com/",
            access_token="token",
            content="Test",
            category="local_news",
            region_lat=45.0,
            region_lng=-122.0,
        )

        call_args = mock_post.call_args
        url = call_args[0][0] if call_args[0] else call_args.kwargs.get("url")
        assert url == "https://api.pantopus.com/api/posts"

    @patch("src.pipeline.poster.httpx.post")
    def test_all_categories_have_mappings(self, mock_post):
        """Every category in ALL_CATEGORIES must have both postType and purpose mappings."""
        for cat in ALL_CATEGORIES:
            assert cat in CATEGORY_TO_POST_TYPE, f"{cat} missing from CATEGORY_TO_POST_TYPE"
            assert cat in CATEGORY_TO_PURPOSE, f"{cat} missing from CATEGORY_TO_PURPOSE"

    @patch("src.pipeline.poster.httpx.post")
    def test_2xx_with_no_id_returns_error(self, mock_post):
        """2xx response missing id field should return an error."""
        mock_post.return_value = _mock_response(201, {"success": True})

        post_id, error = post_to_pantopus(
            api_base_url="https://api.pantopus.com",
            access_token="token",
            content="Test",
            category="local_news",
            region_lat=45.0,
            region_lng=-122.0,
        )
        assert post_id is None
        assert error == "no_post_id_in_response"

    @patch("src.pipeline.poster.httpx.post")
    def test_media_urls_included_in_body(self, mock_post):
        """mediaUrls and mediaTypes appear in the request body when provided."""
        mock_post.return_value = _mock_response(201, {"post": {"id": "media-post"}})

        post_id, error = post_to_pantopus(
            api_base_url="https://api.pantopus.com",
            access_token="token",
            content="Check out this photo!",
            category="local_news",
            region_lat=45.0,
            region_lng=-122.0,
            media_urls=["https://example.com/photo.jpg"],
            media_types=["image"],
        )
        assert post_id == "media-post"
        assert error is None

        call_kwargs = mock_post.call_args
        body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
        assert body["mediaUrls"] == ["https://example.com/photo.jpg"]
        assert body["mediaTypes"] == ["image"]

    @patch("src.pipeline.poster.httpx.post")
    def test_no_media_omits_media_fields(self, mock_post):
        """mediaUrls/mediaTypes omitted from body when not provided."""
        mock_post.return_value = _mock_response(201, {"post": {"id": "no-media"}})

        post_to_pantopus(
            api_base_url="https://api.pantopus.com",
            access_token="token",
            content="Text only post",
            category="local_news",
            region_lat=45.0,
            region_lng=-122.0,
        )

        call_kwargs = mock_post.call_args
        body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
        assert "mediaUrls" not in body
        assert "mediaTypes" not in body

    @patch("src.pipeline.poster.httpx.post")
    def test_media_types_defaults_to_image(self, mock_post):
        """When media_types is None, defaults to ['image'] * len(media_urls)."""
        mock_post.return_value = _mock_response(201, {"post": {"id": "default-types"}})

        post_to_pantopus(
            api_base_url="https://api.pantopus.com",
            access_token="token",
            content="Photos",
            category="local_news",
            region_lat=45.0,
            region_lng=-122.0,
            media_urls=["https://example.com/a.jpg", "https://example.com/b.jpg"],
            media_types=None,
        )

        call_kwargs = mock_post.call_args
        body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
        assert body["mediaTypes"] == ["image", "image"]
