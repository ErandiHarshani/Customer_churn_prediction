import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import SmsIcon from "@mui/icons-material/Sms";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { getCustomers } from "../api/customers";
import { CustomerTable } from "../components/CustomerTable";
import { BulkSmsDialog } from "../components/BulkSmsDialog";
import type { CustomerSummary, RiskLevel } from "../types";

export function CustomerListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const riskLevel = (searchParams.get("risk_level") as RiskLevel | null) ?? null;

  const [rows, setRows] = useState<CustomerSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    getCustomers({
      page: page + 1,
      page_size: pageSize,
      search: search || undefined,
      risk_level: riskLevel ?? undefined,
    })
      .then((res) => {
        setRows(res.items);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, search, riskLevel]);

  function handleRiskFilterChange(_: unknown, value: RiskLevel | null) {
    setPage(0);
    if (value) {
      setSearchParams({ risk_level: value });
    } else {
      setSearchParams({});
    }
  }

  function toggleRow(customerId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  }

  function toggleAllOnPage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      rows.forEach((row) => {
        if (checked) {
          next.add(row.customer_id);
        } else {
          next.delete(row.customer_id);
        }
      });
      return next;
    });
  }

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5">Customers</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<SmsIcon />}
            onClick={() => setBulkDialogOpen(true)}
          >
            Bulk SMS{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/customers/new")}>
            Add customer
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          size="small"
          label="Search by Customer ID or order category"
          value={search}
          onChange={(e) => {
            setPage(0);
            setSearch(e.target.value);
          }}
          sx={{ minWidth: 300 }}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={riskLevel}
          onChange={handleRiskFilterChange}
        >
          <ToggleButton value="high" color="error">
            High risk
          </ToggleButton>
          <ToggleButton value="medium" color="warning">
            Medium
          </ToggleButton>
          <ToggleButton value="low" color="success">
            Low
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <CustomerTable
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(0);
        }}
        selected={selected}
        onToggleRow={toggleRow}
        onToggleAllOnPage={toggleAllOnPage}
      />

      <BulkSmsDialog
        open={bulkDialogOpen}
        onClose={() => setBulkDialogOpen(false)}
        selectedIds={Array.from(selected)}
        onDone={() => setSelected(new Set())}
      />
    </Box>
  );
}
