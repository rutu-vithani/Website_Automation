"""
Unsplash client. Resolves real image URLs server-side for a given query so
the access key never has to be embedded in any generated HTML/CSS/JS.
"""
import os
import requests

UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY")
UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos"


class UnsplashClient:
    def __init__(self, access_key: str = None):
        self.access_key = access_key or UNSPLASH_ACCESS_KEY
        if not self.access_key:
            raise RuntimeError("UNSPLASH_ACCESS_KEY missing in .env")

    def search_images(self, query: str, count: int = 6, orientation: str = "landscape"):
        """Returns a list of dicts: {url, alt, photographer}."""
        params = {
            "query": query,
            "per_page": count,
            "orientation": orientation,
        }
        headers = {"Authorization": f"Client-ID {self.access_key}"}
        resp = requests.get(UNSPLASH_SEARCH_URL, headers=headers, params=params, timeout=30)
        if resp.status_code != 200:
            # graceful fallback so a single failed query never breaks the build
            return []
        results = resp.json().get("results", [])
        images = []
        for r in results:
            images.append({
                "url": r["urls"].get("regular"),
                "url_full": r["urls"].get("full"),
                "alt": r.get("alt_description") or query,
                "photographer": r.get("user", {}).get("name", "Unsplash"),
            })
        return images

    def get_image_set(self, topic: str, sections: list, per_section: int = 3):
        """
        sections: list of section names e.g. ["hero", "about", "gallery", "team"]
        Returns: { "hero": [...], "about": [...], ... }
        """
        image_set = {}
        for section in sections:
            query = f"{topic} {section}".strip()
            images = self.search_images(query, count=per_section)
            if not images:
                # broaden the query if the specific one returned nothing
                images = self.search_images(topic, count=per_section)
            image_set[section] = images
        return image_set
