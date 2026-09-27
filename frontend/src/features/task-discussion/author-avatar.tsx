import { skipToken, useQuery } from "@apollo/client/react";
import { Avatar } from "@base-ui/react/avatar";
import { DiscussionAvatarDocument } from "@/graphql/graphql";

export function AuthorAvatar({ name, username }: { name: string; username?: string }) {
  const { data } = useQuery(
    DiscussionAvatarDocument,
    username
      ? {
          variables: { username },
          fetchPolicy: "cache-first",
        }
      : skipToken,
  );
  const initials =
    name
      .trim()
      .split(/\s+/u)
      .slice(0, 2)
      .map((part) => Array.from(part)[0] ?? "")
      .join("")
      .toLocaleUpperCase() || "?";
  return (
    <Avatar.Root
      aria-hidden="true"
      className="relative inline-flex size-6 shrink-0 overflow-hidden rounded-full bg-muted text-xs text-foreground"
    >
      <Avatar.Image
        src={data?.discussionAvatar ?? undefined}
        alt=""
        className="size-full object-cover"
      />
      <Avatar.Fallback className="flex size-full items-center justify-center">
        {initials}
      </Avatar.Fallback>
    </Avatar.Root>
  );
}
