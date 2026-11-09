import { useLocation } from "@tanstack/react-router";
import { ShareButton } from "./share-button";

export function PageShare() {
  const location = useLocation();
  if (location.pathname === "/tasks/new" || location.pathname.endsWith("/edit")) return null;
  if (/^\/tasks\/\d+\/?$/.test(location.pathname)) {
    return <ShareButton path={location.pathname.replace(/\/$/, "")} label="Share task" iconOnly />;
  }
  const search = new URLSearchParams(location.searchStr);
  search.delete("returnTo");
  const query = search.toString();
  const path = `${location.pathname}${query ? `?${query}` : ""}${location.hash ? `#${location.hash}` : ""}`;
  return <ShareButton key={path} path={path} label="Share page" iconOnly />;
}
