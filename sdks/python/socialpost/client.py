"""SocialPost API client."""

from __future__ import annotations

from typing import Any, Optional

import requests


class SocialPostClient:
    """Client for the SocialPost API.

    >>> client = SocialPostClient("your-api-key", base_url="http://localhost:3000")
    >>> client.upload_text(user="test", platforms=["x"], title="Hello 🚀")
    """

    def __init__(self, api_key: str, base_url: str = "http://localhost:3000", timeout: int = 120):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers["Authorization"] = f"Apikey {api_key}"

    # -- uploads ----------------------------------------------------------

    def upload_video(self, *, video: str, title: str, user: str, platforms: list[str],
                     description: Optional[str] = None, first_comment: Optional[str] = None,
                     scheduled_date: Optional[str] = None, **overrides: str) -> dict[str, Any]:
        """Post a video to one or more platforms."""
        data = self._payload(title=title, user=user, platforms=platforms, description=description,
                             first_comment=first_comment, scheduled_date=scheduled_date, **overrides)
        with open(video, "rb") as fh:
            return self._post("/api/upload", data=data, files={"video": fh})

    def upload_photos(self, *, photos: list[str], title: str, user: str, platforms: list[str],
                      description: Optional[str] = None, first_comment: Optional[str] = None,
                      scheduled_date: Optional[str] = None, **overrides: str) -> dict[str, Any]:
        """Post one or more photos (carousel where supported)."""
        data = self._payload(title=title, user=user, platforms=platforms, description=description,
                             first_comment=first_comment, scheduled_date=scheduled_date, **overrides)
        handles = [open(p, "rb") for p in photos]
        try:
            files = [("photos[]", fh) for fh in handles]
            return self._post("/api/upload_photos", data=data, files=files)
        finally:
            for fh in handles:
                fh.close()

    def upload_text(self, *, title: str, user: str, platforms: list[str],
                    caption: Optional[str] = None, first_comment: Optional[str] = None,
                    scheduled_date: Optional[str] = None, **overrides: str) -> dict[str, Any]:
        """Post a text-only update."""
        data = self._payload(title=title, user=user, platforms=platforms, description=caption,
                             first_comment=first_comment, scheduled_date=scheduled_date, **overrides)
        return self._post("/api/upload_text", data=data)

    # -- management -------------------------------------------------------

    def status(self, request_id: str) -> dict[str, Any]:
        return self._get("/api/uploadposts/status", params={"request_id": request_id})

    def history(self, page: int = 1, limit: int = 20, **params: str) -> dict[str, Any]:
        return self._get("/api/uploadposts/history", params={"page": page, "limit": limit, **params})

    def scheduled(self) -> dict[str, Any]:
        return self._get("/api/uploadposts/schedule")

    def cancel_scheduled(self, request_id: str) -> dict[str, Any]:
        r = self.session.delete(f"{self.base_url}/api/uploadposts/schedule",
                                params={"request_id": request_id}, timeout=self.timeout)
        return r.json()

    def analytics(self, profile: str, **params: str) -> dict[str, Any]:
        return self._get(f"/api/analytics/{profile}", params=params)

    def me(self) -> dict[str, Any]:
        return self._get("/api/uploadposts/me")

    # -- internals ----------------------------------------------------------

    @staticmethod
    def _payload(**kwargs: Any) -> list[tuple[str, str]]:
        data: list[tuple[str, str]] = []
        platforms = kwargs.pop("platforms", [])
        description = kwargs.pop("description", None)
        first_comment = kwargs.pop("first_comment", None)
        scheduled_date = kwargs.pop("scheduled_date", None)
        for key, value in kwargs.items():
            if value is not None:
                data.append((key, str(value)))
        if description:
            data.append(("description", description))
        if first_comment:
            data.append(("first_comment", first_comment))
        if scheduled_date:
            data.append(("scheduled_date", scheduled_date))
        for p in platforms:
            data.append(("platform[]", p))
        return data

    def _post(self, path: str, **kwargs: Any) -> dict[str, Any]:
        r = self.session.post(f"{self.base_url}{path}", timeout=self.timeout, **kwargs)
        return r.json()

    def _get(self, path: str, params: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        r = self.session.get(f"{self.base_url}{path}", params=params, timeout=self.timeout)
        return r.json()
