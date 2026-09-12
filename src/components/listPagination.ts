/** How many rows a list shows until someone says otherwise. */
export const DEFAULT_PAGE_SIZE = 20;

export const PAGE_SIZE_OPTIONS = ['20', '50', '100'];

interface Options {
  /** Zero-based, as the API counts. antd counts from one. */
  page: number;
  pageSize: number;
  total: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  /** Plural noun for the running total — "products", "images". */
  label: string;
}

/**
 * One pagination config for every list, so the four of them agree on page size, on the
 * options offered, and on what the footer says.
 *
 * Page size belongs in the query's filters rather than beside them, so changing it starts
 * again at the first page: asking for rows 40-60 of a list now measured in fifties would
 * land somewhere nobody chose.
 */
export function listPagination({ page, pageSize, total, setPage, setPageSize, label }: Options) {
  return {
    current: page + 1,
    pageSize,
    total,
    showSizeChanger: true,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    onChange: (nextPage: number, nextSize: number) => {
      // antd reports both together; only one of them has actually changed.
      if (nextSize !== pageSize) setPageSize(nextSize);
      else setPage(nextPage - 1);
    },
    showTotal: (t: number, range: [number, number]) => `${range[0]}-${range[1]} of ${t} ${label}`,
  };
}
