export type PaginationItem = number | "start-ellipsis" | "end-ellipsis";

export function paginationRange(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 3) return [1, 2, 3, "end-ellipsis", totalPages];
  if (currentPage >= totalPages - 2) {
    return [1, "start-ellipsis", totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "start-ellipsis", currentPage, "end-ellipsis", totalPages];
}
