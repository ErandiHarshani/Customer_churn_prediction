import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";
import Checkbox from "@mui/material/Checkbox";
import Box from "@mui/material/Box";
import { useNavigate } from "react-router-dom";
import { RiskBadge } from "./RiskBadge";
import type { CustomerSummary } from "../types";

interface CustomerTableProps {
  rows: CustomerSummary[];
  total: number;
  page: number; // 0-indexed for MUI
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  selected: Set<number>;
  onToggleRow: (customerId: number) => void;
  onToggleAllOnPage: (checked: boolean) => void;
}

export function CustomerTable({
  rows,
  total,
  page,
  pageSize,
  loading,
  onPageChange,
  onPageSizeChange,
  selected,
  onToggleRow,
  onToggleAllOnPage,
}: CustomerTableProps) {
  const navigate = useNavigate();

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.customer_id));
  const someOnPageSelected = rows.some((r) => selected.has(r.customer_id));

  return (
    <Paper variant="outlined">
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allOnPageSelected}
                  indeterminate={someOnPageSelected && !allOnPageSelected}
                  onChange={(e) => onToggleAllOnPage(e.target.checked)}
                  disabled={rows.length === 0}
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
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.customer_id}
                  hover
                  selected={selected.has(row.customer_id)}
                  sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/customers/${row.customer_id}`)}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(row.customer_id)}
                      onChange={() => onToggleRow(row.customer_id)}
                    />
                  </TableCell>
                  <TableCell>{row.customer_id}</TableCell>
                  <TableCell>
                    <RiskBadge level={row.risk_level} />
                  </TableCell>
                  <TableCell align="right">{(row.churn_probability * 100).toFixed(1)}%</TableCell>
                  <TableCell align="right">{row.tenure ?? "-"}</TableCell>
                  <TableCell>{row.prefered_order_cat ?? "-"}</TableCell>
                  <TableCell align="center">{row.complain ? "Yes" : "No"}</TableCell>
                  <TableCell>{row.sentiment_label ?? "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => onPageChange(newPage)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </Box>
    </Paper>
  );
}
