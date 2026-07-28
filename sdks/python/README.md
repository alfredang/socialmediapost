# SocialPost Python SDK

One API call to post on all social platforms.

```bash
pip install -e sdks/python
```

```python
from socialpost import SocialPostClient

client = SocialPostClient("your-api-key", base_url="http://localhost:3000")

# Video to three platforms
client.upload_video(
    video="./video.mp4",
    title="Your Video Title 🚀",
    user="your_profile_user",
    platforms=["tiktok", "instagram", "youtube"],
)

# Photos
client.upload_photos(photos=["a.jpg", "b.png"], title="Album 📸",
                     user="your_profile_user", platforms=["instagram"])

# Text (with per-platform override + schedule)
client.upload_text(title="Big news! 🎉", user="your_profile_user",
                   platforms=["x", "linkedin"],
                   x_title="Short & punchy 🎉",
                   scheduled_date="2026-08-01T09:00:00+08:00")

# LinkedIn document
client.upload_document(document="./deck.pdf", title="Our 2026 roadmap",
                      user="your_profile_user", platforms=["linkedin"])

# Queue: inspect slots, then attach a draft to the next one
client.next_slot("your_profile_user")          # next free slot (ISO) or None
client.preview_queue("your_profile_user")      # upcoming slots
client.update_queue_settings(user="your_profile_user", timezone="Asia/Kuala_Lumpur",
                             slot_times=["09:00", "18:00"])
client.add_to_queue("request-id")

# Reschedule
client.edit_scheduled("request-id", "2026-08-02T09:00:00+08:00")

# Analytics / status / history
client.analytics("your_profile_user", platform="instagram")
client.post_analytics("request-id")
client.status("request-id")
client.history(page=1)
client.platform_metrics()                      # public — no key needed
client.media(user="your_profile_user")
client.pages("your_profile_user")              # Facebook Pages you can publish to

# Comments on a published post (Facebook only)
comments = client.comments("request-id")["comments"]
if comments:
    client.reply_to_comment("request-id", comments[0]["id"], "Thanks! 🙌")

# White-label connect links
token = client.generate_jwt("your_profile_user")["access_token"]
client.validate_jwt(token)                      # public — no key needed
```

### Webhooks

Set your account webhook URL in the dashboard; SocialPost POSTs a JSON body when
a post finishes. Parse it into a typed event:

```python
from socialpost import parse_webhook_event

# e.g. inside a Flask handler: @app.post("/hook")
evt = parse_webhook_event(request.get_json())   # or parse_webhook_event(raw_json_string)
# {"event": "post.completed", "request_id": ..., "status": ..., "results": {...}}
```
