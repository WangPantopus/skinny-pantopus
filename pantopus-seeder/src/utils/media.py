"""Helpers for normalizing and deduplicating media URLs across sources."""

from __future__ import annotations

import re
from urllib.parse import urlsplit, urlunsplit

# CDN/WordPress resize suffix, e.g. "-1200x800.jpg" or "-150x150.png".
_RESIZE_SUFFIX_RE = re.compile(r"-\d{2,5}x\d{2,5}(?=\.[A-Za-z0-9]{2,5}$)")


def canonicalize_media_url(url: str | None) -> str:
    """Return a canonical form of a media URL for duplicate detection.

    The same image is often served under several URLs that differ only in
    incidentals:
      - query strings for cache busting or resize hints ("?w=1200", "?v=2")
      - WordPress/CDN size suffixes ("image-1200x800.jpg" vs "image.jpg")
      - URL fragments
      - scheme/host casing or leading/trailing whitespace

    Normalising these away lets us treat visually identical images as the
    same attachment.  Returns an empty string for empty/None input.
    """
    if not url:
        return ""
    cleaned = url.strip()
    if not cleaned:
        return ""

    try:
        parts = urlsplit(cleaned)
    except ValueError:
        return cleaned.lower()

    scheme = parts.scheme.lower()
    netloc = parts.netloc.lower()
    path = _RESIZE_SUFFIX_RE.sub("", parts.path)
    # Drop query + fragment — they're almost always size/cache variants.
    canonical = urlunsplit((scheme, netloc, path, "", ""))
    return canonical.lower()
