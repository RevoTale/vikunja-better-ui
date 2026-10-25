import { GitFork } from "lucide-react";

const repositoryURL = "https://github.com/RevoTale/vikunja-better-ui";

export function PublicPageFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t py-5 text-sm text-muted-foreground">
      <span>Independent, self-hosted deployment</span>
      <a
        href={repositoryURL}
        className="inline-flex items-center gap-2 underline underline-offset-4"
      >
        <GitFork className="size-4" aria-hidden="true" />
        <span>Open-source software · View source on GitHub</span>
      </a>
    </footer>
  );
}
