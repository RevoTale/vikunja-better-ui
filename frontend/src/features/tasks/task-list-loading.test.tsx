import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { TaskListLoading } from "./task-list-loading";

it("reserves three badge placeholders for each of three task rows", () => {
  const markup = renderToStaticMarkup(<TaskListLoading />);
  expect(markup.match(/data-slot="task-loading-badge"/g)).toHaveLength(9);
});
