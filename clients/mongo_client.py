"""
MongoDB client used by the Database Agent.
Each generated website project gets its own set of collections, named
project_<slug>_<section>, so multiple projects never collide.
"""
import os
import re
from pymongo import MongoClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.environ.get("MONGO_DB_NAME", "generated_website_db")


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return re.sub(r"_+", "_", text).strip("_")


class MongoStore:
    def __init__(self, uri: str = None, db_name: str = None):
        self.client = MongoClient(uri or MONGO_URI)
        self.db = self.client[db_name or MONGO_DB_NAME]

    def collection_name(self, project_slug: str, section: str) -> str:
        return f"project_{project_slug}_{section}"

    def save_section(self, project_slug: str, section: str, document: dict):
        """Upsert a document for a given project+section (e.g. frontend, backend, meta)."""
        coll = self.db[self.collection_name(project_slug, section)]
        document = {**document, "project_slug": project_slug}
        coll.update_one(
            {"project_slug": project_slug, "_key": document.get("_key", "main")},
            {"$set": document},
            upsert=True,
        )
        return coll.name

    def get_section(self, project_slug: str, section: str, key: str = "main"):
        coll = self.db[self.collection_name(project_slug, section)]
        return coll.find_one({"project_slug": project_slug, "_key": key})

    def list_projects(self):
        names = self.db.list_collection_names()
        slugs = set()
        for n in names:
            m = re.match(r"^project_(.+)_(frontend|backend|database|testing|meta)$", n)
            if m:
                slugs.add(m.group(1))
        return sorted(slugs)
