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

# Analytics / status / history
client.analytics("your_profile_user", platform="instagram")
client.status("request-id")
client.history(page=1)
```
