from clients.mongo_client import MongoStore

class DatabaseAgent:
    def __init__(self, mongo_store: MongoStore = None):
        self.store = mongo_store or MongoStore()

    def save_frontend_output(self, project_slug: str, brief: dict, frontend_output: dict):
        doc = {
            "_key": "main",
            "business_name": brief.get("business_name"),
            "business_type": brief.get("business_type"),
            "sections": brief.get("sections"),
            "html": frontend_output["html"],
            "css": frontend_output["css"],
            "js": frontend_output["js"],
            "images_used": frontend_output.get("images_used", []),
        }
        return self.store.save_section(project_slug, "frontend", doc)

    def save_meta(self, project_slug: str, brief: dict):
        return self.store.save_section(project_slug, "meta", {"_key": "main", **brief})

    def prepare_runtime_collections(self, project_slug: str):
        """
        Pre-creates empty collections the generated backend will write to at
        runtime (e.g. contact form submissions, admin-panel edited content).
        Returns the collection names so the Backend Agent can reference them
        exactly.
        """
        contact_coll = self.store.collection_name(project_slug, "contact_messages")
        testimonials_coll = self.store.collection_name(project_slug, "testimonials")
        site_content_coll = self.store.collection_name(project_slug, "site_content")
        # touch them so they exist
        self.store.db[contact_coll].create_index("created_at")
        self.store.db[site_content_coll].create_index("project_slug")
        return {
            "contact_collection": contact_coll,
            "testimonials_collection": testimonials_coll,
            "site_content_collection": site_content_coll,
        }

    def save_backend_output(self, project_slug: str, backend_code: str):
        return self.store.save_section(project_slug, "backend", {"_key": "main", "app_py": backend_code})

    def save_admin_content(self, project_slug: str, content: dict):
        """
        Persists the Admin Agent's initial content map (editable text/images
        + "View Details" detail records) so it's backed up in Mongo the same
        way the generated project's local content.json file is, even before
        anyone opens /admin and hits Save.
        """
        return self.store.save_section(project_slug, "site_content", {
            "_key": "main",
            "editable": content.get("editable", {}),
            "details": content.get("details", []),
        })

    def save_testing_report(self, project_slug: str, report: dict):
        return self.store.save_section(project_slug, "testing", {"_key": "main", **report})