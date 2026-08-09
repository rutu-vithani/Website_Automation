import os
import base64
from github import Github, GithubException

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_USERNAME = os.environ.get("GITHUB_USERNAME")
GITHUB_REPO_NAME = os.environ.get("GITHUB_REPO_NAME", "website-automation")


class GitHubPusher:
    def __init__(self, token: str = None, username: str = None, repo_name: str = None):
        self.token = token or GITHUB_TOKEN
        self.username = username or GITHUB_USERNAME
        self.repo_name = repo_name or GITHUB_REPO_NAME
        if not self.token:
            raise RuntimeError("GITHUB_TOKEN missing in .env")
        self.gh = Github(self.token)
        self.repo = self._get_or_create_repo()

    def _get_or_create_repo(self):
        user = self.gh.get_user()
        try:
            return user.get_repo(self.repo_name)
        except GithubException:
            return user.create_repo(self.repo_name, private=True, auto_init=True)

    def _ensure_branch(self, branch_name: str):
        try:
            self.repo.get_branch(branch_name)
        except GithubException:
            base = self.repo.get_branch(self.repo.default_branch)
            self.repo.create_git_ref(ref=f"refs/heads/{branch_name}", sha=base.commit.sha)

    def push_project(self, project_slug: str, local_dir: str, commit_message: str = None):
        """
        Pushes every file under local_dir to a branch named after project_slug,
        inside a top-level folder of the same name in the repo.
        """
        branch_name = project_slug
        self._ensure_branch(branch_name)
        commit_message = commit_message or f"Add/update generated project: {project_slug}"

        for root, _, files in os.walk(local_dir):
            for fname in files:
                local_path = os.path.join(root, fname)
                rel_path = os.path.relpath(local_path, local_dir)
                repo_path = f"{project_slug}/{rel_path}".replace(os.sep, "/")

                with open(local_path, "rb") as f:
                    content_bytes = f.read()

                try:
                    existing = self.repo.get_contents(repo_path, ref=branch_name)
                    self.repo.update_file(
                        repo_path, commit_message, content_bytes, existing.sha, branch=branch_name
                    )
                except GithubException:
                    self.repo.create_file(
                        repo_path, commit_message, content_bytes, branch=branch_name
                    )

        return {
            "repo_url": self.repo.html_url,
            "branch": branch_name,
            "folder": project_slug,
        }
