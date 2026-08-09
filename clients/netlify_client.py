import os
import io
import zipfile
import requests

NETLIFY_API = "https://api.netlify.com/api/v1"
NETLIFY_TOKEN = os.environ.get("NETLIFY_TOKEN")


class NetlifyDeployer:
    def __init__(self, token: str = None):
        self.token = token or NETLIFY_TOKEN
        if not self.token:
            raise RuntimeError(
                "NETLIFY_TOKEN missing. Add it to your .env file "
                "(get one from https://app.netlify.com/user/applications#personal-access-tokens)."
            )
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/zip",
        }

    # ---------- helpers ----------

    def _zip_directory(self, dir_path: str) -> bytes:
        if not os.path.isdir(dir_path):
            raise RuntimeError(f"Cannot deploy — directory does not exist: {dir_path}")
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            found = False
            for root, _, files in os.walk(dir_path):
                for fname in files:
                    full_path = os.path.join(root, fname)
                    rel_path = os.path.relpath(full_path, dir_path)
                    zf.write(full_path, rel_path)
                    found = True
            if not found:
                raise RuntimeError(f"Directory is empty, nothing to deploy: {dir_path}")
        buf.seek(0)
        return buf.read()

    def _normalize_site(self, data: dict) -> dict:
        return {
            "site_id": data.get("site_id") or data.get("id"),
            "url": data.get("ssl_url") or data.get("url") or data.get("deploy_ssl_url"),
            "admin_url": data.get("admin_url"),
            "name": data.get("name"),
            "deploy_id": data.get("id") if data.get("site_id") else None,
        }

    # ---------- public API ----------

    def deploy_directory(self, dir_path: str, site_name: str = None) -> dict:
        """
        Creates a brand-new Netlify site and deploys `dir_path` to it in one
        call. Returns {"site_id", "url", "admin_url", "name"}.
        """
        zip_bytes = self._zip_directory(dir_path)
        url = f"{NETLIFY_API}/sites"
        if site_name:
            url += f"?name={site_name}"
        resp = requests.post(url, headers=self.headers, data=zip_bytes, timeout=180)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Netlify deploy failed ({resp.status_code}): {resp.text[:500]}")
        return self._normalize_site(resp.json())

    def redeploy(self, site_id: str, dir_path: str) -> dict:
        """Pushes a new deploy of `dir_path` to an already-existing site_id."""
        zip_bytes = self._zip_directory(dir_path)
        url = f"{NETLIFY_API}/sites/{site_id}/deploys"
        resp = requests.post(url, headers=self.headers, data=zip_bytes, timeout=180)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Netlify redeploy failed ({resp.status_code}): {resp.text[:500]}")
        data = resp.json()
        return {
            "site_id": site_id,
            "url": data.get("ssl_url") or data.get("url") or data.get("deploy_ssl_url"),
        }