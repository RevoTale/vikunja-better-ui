import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import { paginationRange } from "./pagination-range";

export function TaskPagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (currentPage > totalPages)
    return (
      <Button className="mt-3" variant="outline" onClick={() => onPageChange(totalPages)}>
        Show remaining tasks
      </Button>
    );
  if (totalPages === 1) return null;
  return (
    <Pagination className="mt-5">
      <PaginationContent>
        <PaginationItem>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Go to previous page"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </Button>
        </PaginationItem>
        {paginationRange(currentPage, totalPages).map((item) => (
          <PaginationItem key={item}>
            {typeof item === "string" ? (
              <PaginationEllipsis />
            ) : (
              <Button
                variant={item === currentPage ? "outline" : "ghost"}
                size="icon"
                aria-current={item === currentPage ? "page" : undefined}
                aria-label={`Go to page ${item}`}
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Go to next page"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
