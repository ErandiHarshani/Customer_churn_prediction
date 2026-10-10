import type { ReactNode } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import Paper from "@mui/material/Paper";
import Checkbox from "@mui/material/Checkbox";
import LinearProgress from "@mui/material/LinearProgress";
import Skeleton from "@mui/material/Skeleton";
import Box from "@mui/material/Box";
import { useLocation, useNavigate } from "react-router-dom";
import { RiskBadge } from "./RiskBadge";
import { formatProbability } from "../utils/format";
import type { CustomerSummary } from "../types";

interface CustomerTableProps {
  rows: CustomerSummary[];
  total: number;
  page: number; // 0-indexed for MUI
  pageSize: number;
  pageSizes: number[];
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  selected: Set<number>;
  onToggleRow: (customerId: number) => void;
  onToggleAllOnPage: (checked: boolean) => void;
  /** shown when the (loaded) result is empty */
  empty: ReactNode;
  /** search/filter bar rendered at the top of the card */
  toolbar?: ReactNode;
  /** when set, replaces the table (e.g. a load error), keeping the toolbar */
  error?: ReactNode;
}

const COLUMNS = 8;

export function CustomerTable({
  rows,
  total,
  page,
  pageSize,
  pageSizes,
  loading,
  onPageChange,
  onPageSizeChange,
  selected,
  onToggleRow,
  onToggleAllOnPage,
  empty,
  toolbar,
  error,
}: CustomerTableProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.customer_id));
  const someOnPageSelected = rows.some((r) => selected.has(r.customer_id));
  const firstLoad = loading && rows.length === 0;

  // remember the list URL so the detail page's breadcrumb returns to this exact view
  const open = (id: number) => navigate(`/customers/${id}`, { state: { from: location.pathname + location.search } });

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      {toolbar}
      {error ? (
        <Box sx={{ p: 2 }}>{error}</Box>
      ) : (
      <Box sx={{ position: "relative" }}>
      {/* refetch indicator: rows stay put instead of collapsing to a spinner */}
      <LinearProgress
        aria-label="Loading customers"
        sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 1, opacity: loading && !firstLoad ? 1 : 0 }}
      />
      <TableContainer>
        <Table size="medium">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allOnPageSelected}
                  indeterminate={someOnPageSelected && !allOnPageSelected}
                  onChange={(e) => onToggleAllOnPage(e.target.checked)}
                  disabled={rows.length === 0}
                  slotProps={{ input: { "aria-label": "Select all customers on this page" } }}
                />
              </TableCell>
              <TableCell>Customer ID</TableCell>
              <TableCell>Risk</TableCell>
              <TableCell align="right">Churn probability</TableCell>
              <TableCell align="right">Tenure (months)</TableCell>
              <TableCell>Order category</TableCell>
              <TableCell align="center">Complaint</TableCell>
              <TableCell>Sentiment</TableCell>
            </TableRow>
          </TableHead>
          <TableBody sx={{ opacity: loading && !firstLoad ? 0.6 : 1, transition: "opacity 150ms ease" }}>
            {firstLoad ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`sk${i}`}>
                  <TableCell colSpan={COLUMNS}>
                    <Skeleton variant="text" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS} sx={{ borderBottom: 0 }}>
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.customer_id}
                  hover
                  selected={selected.has(row.customer_id)}
                  tabIndex={0}
                  aria-label={`Open customer ${row.customer_id}`}
                  sx={{
                    cursor: "pointer",
                    "&:focus-visible": { outline: (t) => `2px solid ${t.palette.primary.main}`, outlineOffset: -2 },
                  }}
                  onClick={() => open(row.customer_id)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return; // let the checkbox handle its own keys
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      open(row.customer_id);
                    }
                  }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(row.customer_id)}
                      onChange={() => onToggleRow(row.customer_id)}
                      slotProps={{ input: { "aria-label": `Select customer ${row.customer_id}` } }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>#{row.customer_id}</TableCell>
                  <TableCell>
                    <RiskBadge level={row.risk_level} />
                  </TableCell>
                  <TableCell align="right">{formatProbability(row.churn_probability)}</TableCell>
                  <TableCell align="right">{row.tenure ?? "–"}</TableCell>
                  <TableCell>{row.prefered_order_cat ?? "–"}</TableCell>
                  <TableCell align="center">{row.complain == null ? "–" : row.complain ? "Yes" : "No"}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{row.sentiment_label ?? "–"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: "flex", justifyContent: "flex-end", borderTop: 1, borderColor: "divider" }}>
        <TablePagination
          component="div"
          count={total}
          page={total === 0 ? 0 : page}
          onPageChange={(_, newPage) => onPageChange(newPage)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
          rowsPerPageOptions={pageSizes}
          labelDisplayedRows={({ from, to, count }) =>
            `${from.toLocaleString()}–${to.toLocaleString()} of ${count.toLocaleString()}`
          }
        />
      </Box>
      </Box>
      )}
    </Paper>
  );
}
