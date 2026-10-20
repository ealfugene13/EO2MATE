import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "eo2mate.records-per-page.v1";
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function getSavedPageSize() {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return PAGE_SIZE_OPTIONS.includes(value) ? value : 10;
  } catch {
    return 10;
  }
}

export function useRecordPagination(records = [], resetToken = null) {
  const [pageSize, setPageSize] = useState(getSavedPageSize);
  const [page, setPage] = useState(1);
  const total = records.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = useMemo(
    () => records.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [records, currentPage, pageSize],
  );

  useEffect(() => setPage(1), [resetToken]);

  function changePageSize(event) {
    const next = Number(event.target.value);
    if (!PAGE_SIZE_OPTIONS.includes(next)) return;
    setPageSize(next);
    setPage(1);
    try { window.localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* Keep the in-memory choice if storage is unavailable. */ }
  }

  return { visibleRecords, pageSize, page: currentPage, totalPages, total, setPage, changePageSize };
}

export default function RecordPagination({ pagination, label = "records", className = "" }) {
  const { page, pageSize, totalPages, total, setPage, changePageSize } = pagination;
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  return <div className={`record-pagination ${className}`.trim()}>
    <span>Showing {start}–{end} of {total} {label}</span>
    <div className="record-pagination-actions">
      <label>Rows
        <select aria-label={`Rows per page for ${label}`} value={pageSize} onChange={changePageSize}>
          {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page">Previous</button>
      <span>Page {page} of {totalPages}</span>
      <button type="button" onClick={() => setPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">Next</button>
    </div>
  </div>;
}
