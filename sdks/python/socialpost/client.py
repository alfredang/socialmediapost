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

    def upload_document(self, *, document: str, title: str, user: str, platforms: list[str],
                        description: Optional[str] = None, first_comment: Optional[str] = None,
                        scheduled_date: Optional[str] = None, **overrides: str) -> dict[str, Any]:
        """Post a LinkedIn document (PDF/PPT/DOC/DOCX)."""
        data = self._payload(title=title, user=user, platforms=platforms, description=description,
                             first_comment=first_comment, scheduled_date=scheduled_date, **overrides)
        with open(document, "rb") as fh:
            return self._post("/api/uploadposts/upload-document", data=data, files={"document": fh})

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

    def edit_scheduled(self, request_id: str, scheduled_date: str) -> dict[str, Any]:
        """Reschedule a scheduled post. scheduled_date is an ISO 8601 string."""
        return self._json("PATCH", "/api/uploadposts/schedule",
                          {"request_id": request_id, "scheduled_date": scheduled_date})

    def analytics(self, profile: str, **params: str) -> dict[str, Any]:
        return self._get(f"/api/analytics/{profile}", params=params)

    def post_analytics(self, request_id: str) -> dict[str, Any]:
        return self._get(f"/api/uploadposts/post-analytics/{request_id}")

    def me(self) -> dict[str, Any]:
        return self._get("/api/uploadposts/me")

    def platform_metrics(self) -> dict[str, Any]:
        """Metrics + constraints available per platform (public — no key required)."""
        return self._get("/api/uploadposts/platform-metrics")

    def media(self, **params: str) -> dict[str, Any]:
        """Recently published media. Optional filters: user, platform."""
        return self._get("/api/uploadposts/media", params=params)

    def pages(self, user: str, platform: str = "facebook") -> dict[str, Any]:
        """Facebook Pages the connected account can publish to (Facebook only)."""
        return self._get("/api/uploadposts/pages", params={"user": user, "platform": platform})

    def comments(self, request_id: str, platform: str = "facebook") -> dict[str, Any]:
        """Comments on a published post (Facebook only)."""
        return self._get("/api/uploadposts/comments",
                         params={"request_id": request_id, "platform": platform})

    def reply_to_comment(self, request_id: str, comment_id: str, message: str,
                         platform: str = "facebook") -> dict[str, Any]:
        """Reply to a comment on a published post (Facebook only)."""
        return self._json("POST", "/api/uploadposts/comments",
                          {"request_id": request_id, "comment_id": comment_id,
                           "message": message, "platform": platform})

    # -- queue ------------------------------------------------------------

    def queue_settings(self, user: str) -> dict[str, Any]:
        """Queue settings + a preview of the next slots for a profile."""
        return self._get("/api/uploadposts/queue/settings", params={"user": user})

    def update_queue_settings(self, *, user: str, timezone: Optional[str] = None,
                              active_days: Optional[list[int]] = None,
                              slot_times: Optional[list[str]] = None,
                              max_per_slot: Optional[int] = None) -> dict[str, Any]:
        """Update queue settings for a profile."""
        payload: dict[str, Any] = {"user": user}
        if timezone is not None:
            payload["timezone"] = timezone
        if active_days is not None:
            payload["active_days"] = active_days
        if slot_times is not None:
            payload["slot_times"] = slot_times
        if max_per_slot is not None:
            payload["max_per_slot"] = max_per_slot
        return self._json("PUT", "/api/uploadposts/queue/settings", payload)

    def add_to_queue(self, request_id: str) -> dict[str, Any]:
        """Attach an existing draft/scheduled post to the next free queue slot."""
        return self._json("POST", "/api/uploadposts/add_to_queue", {"request_id": request_id})

    def preview_queue(self, user: str) -> list[str]:
        """Upcoming queue slots (ISO strings) for a profile."""
        return self.queue_settings(user).get("next_slots", [])

    def next_slot(self, user: str) -> Optional[str]:
        """The single next free queue slot (ISO string) for a profile, or None."""
        slots = self.preview_queue(user)
        return slots[0] if slots else None

    # -- white-label connect JWTs -----------------------------------------

    def generate_jwt(self, username: str) -> dict[str, Any]:
        """Generate a shareable connect-link token for a profile."""
        return self._json("POST", "/api/uploadposts/users/generate-jwt", {"username": username})

    def validate_jwt(self, token: str) -> dict[str, Any]:
        """Validate a connect-link token (public — no key required)."""
        return self._get("/api/uploadposts/users/validate-jwt", params={"token": token})

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

    def _json(self, method: str, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        r = self.session.request(method, f"{self.base_url}{path}", json=payload, timeout=self.timeout)
        return r.json()


def parse_webhook_event(body: Any) -> dict[str, Any]:
    """Parse a SocialPost webhook payload into a typed event.

    Set your account's webhook URL in the dashboard; SocialPost then POSTs JSON
    to it. The only event today is ``post.completed``::

        {"event": "post.completed", "request_id": ..., "status": ..., "results": {...}}

    ``body`` may be the parsed dict or the raw JSON string.
    """
    import json as _json_mod

    payload = _json_mod.loads(body) if isinstance(body, (str, bytes, bytearray)) else body
    if not isinstance(payload, dict) or not isinstance(payload.get("event"), str):
        raise ValueError("Not a SocialPost webhook payload")
    if payload["event"] != "post.completed":
        raise ValueError(f"Unknown webhook event: {payload['event']}")
    return {
        "event": payload["event"],
        "request_id": payload.get("request_id"),
        "status": payload.get("status"),
        "results": payload.get("results") or {},
    }
