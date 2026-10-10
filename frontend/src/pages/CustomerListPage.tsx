import { useEffect, useState } from "react";
import { Link as RouterLink, useLocation, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import AddIcon from "@mui/icons-material/Add";
import SmsIcon from "@mui/icons-material/Sms";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { getCustomers } from "../api/customers";
import { CustomerTable } from "../components/CustomerTable";
import { BulkSmsDialog } from "../components/BulkSmsDialog";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState } from "../components/PageStates";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { apiErrorMessage } from "../utils/apiError";
import type { CustomerListResponse, RiskLevel } from "../types";

const PAGE_SIZES = [10, 20, 50];

export function CustomerListPage() {
  // All list state lives in the URL, so Back / reload / returning from a
  // customer restores exactly this view.
  const [searchParams, setSearchParams] = useSearchParams();
  const riskLevel = (searchParams.get("risk_level") as RiskLevel | null) ?? null;
  const query = searchParams.get("q") ?? "";
  const page = Math.max(0, Number(searchParams.get("page") ?? "1") - 1);
  const sizeParam = Number(searchParams.get("size") ?? "20");
  const pageSize = PAGE_SIZES.includes(sizeParam) ? sizeParam : 20;

  // The box follows the URL until the user types. Typed text belongs to one history
  // entry: Back/Forward (or the debounced commit, which replaces the entry) gives a
  // new location.key, so the box goes back to showing what the URL says.
  const { key: locationKey } = useLocation();
  const [typed, setTyped] = useState({ forKey: locationKey, value: query });
  const searchInput = typed.forKey === locationKey ? typed.value : query;
  const setSearchInput = (value: string) => setTyped({ forKey: locationKey, value });
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);

  // results are tagged with the request they answer, so a slow earlier response
  // can never overwrite a newer one, and "loading" needs no extra state
  const requestKey = JSON.stringify([page, pageSize, query, riskLevel]);
  const [data, setData] = useState<{ key: string; res: CustomerListResponse } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  // a successful response for this view always wins over an older failure for it
  const hasData = data?.key === requestKey;
  const showError = !hasData && failure?.key === requestKey;
  const loading = !hasData && !showError;

  // selection belongs to one filter combination; changing filters starts fresh
  const filterKey = JSON.stringify([query, riskLevel]);
  const [selection, setSelection] = useState<{ key: string; ids: Set<number> }>({ key: filterKey, ids: new Set() });
  const selected = selection.key === filterKey ? selection.ids : new Set<number>();

  const [bulkDialogKey, setBulkDialogKey] = useState(0);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  function updateParams(changes: Record<string, string | null>, replace = false) {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    setSearchParams(next, { replace });
  }

  // apply the debounced search to the URL (replace: typing shouldn't flood history)
  useEffect(() => {
    // only once typing has settled, and never with a value the URL has moved past
    if (debouncedSearch === query || debouncedSearch !== searchInput.trim()) return;
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set("q", debouncedSearch);
    else next.delete("q");
    next.delete("page");
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, searchInput, query, searchParams, setSearchParams]);

  useEffect(() => {
    const key = JSON.stringify([page, pageSize, query, riskLevel]);
    let stale = false; // a newer request superseded this one
    getCustomers({
      page: page + 1,
      page_size: pageSize,
      search: query || undefined,
      risk_level: riskLevel ?? undefined,
    })
      .then((res) => {
        if (stale) return;
        setData({ key, res });
        setFailure((f) => (f?.key === key ? null : f));
      })
      .catch((e) => !stale && setFailure({ key, message: apiErrorMessage(e, "Could not load customers.") }));
    return () => {
      stale = true;
    };
  }, [page, pageSize, query, riskLevel, retryTick]);

  function handleRiskFilterChange(_: unknown, value: RiskLevel | null) {
    updateParams({ risk_level: value, page: null });
  }

  function clearFilters() {
    setSearchInput("");
    setSearchParams(new URLSearchParams(), { replace: false });
  }

  function setSelected(ids: Set<number>) {
    setSelection({ key: filterKey, ids });
  }

  function toggleRow(customerId: number) {
    const next = new Set(selected);
    if (next.has(customerId)) next.delete(customerId);
    else next.add(customerId);
    setSelected(next);
  }

  function toggleAllOnPage(checked: boolean) {
    const next = new Set(selected);
    (data?.res.items ?? []).forEach((row) => (checked ? next.add(row.customer_id) : next.delete(row.customer_id)));
    setSelected(next);
  }

  const rows = data?.res.items ?? [];
  const total = data?.res.total ?? 0;
  const hasFilters = !!query || !!riskLevel;

  return (
    <Box>
      <PageHeader
        title="Customers"
        subtitle="Every customer scored by the churn model, highest risk first."
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<SmsIcon />}
              onClick={() => {
                setBulkDialogKey((k) => k + 1); // fresh dialog state every time it opens
                setBulkDialogOpen(true);
              }}
            >
              {selected.size > 0 ? `Bulk SMS (${selected.size} selected)` : "Bulk SMS"}
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} component={RouterLink} to="/customers/new">
              Add customer
            </Button>
          </>
        }
      />

      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
        <TextField
          size="small"
          label="Search customers"
          placeholder="e.g. 50001 or Mobile Phone"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          helperText="Customer ID (exact) or order category"
          sx={{ width: { xs: "100%", sm: 340 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchInput ? (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label="Clear search" onClick={() => setSearchInput("")} edge="end">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            },
          }}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={riskLevel}
          onChange={handleRiskFilterChange}
          aria-label="Filter by risk level"
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
        {hasFilters && (
          <Button onClick={clearFilters} startIcon={<ClearIcon />}>
            Clear filters
          </Button>
        )}
      </Box>

      {selected.size > 0 && (
        <Paper
          variant="outlined"
          sx={{ mb: 2, px: 2, py: 1, display: "flex", alignItems: "center", gap: 2, bgcolor: "primary.light", borderColor: "primary.light" }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, color: "primary.main" }}>
            {selected.size.toLocaleString()} selected
          </Typography>
          <Button size="small" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </Paper>
      )}

      {showError ? (
        <ErrorState
          message={failure!.message}
          onRetry={() => {
            setFailure(null);
            setRetryTick((t) => t + 1);
          }}
        />
      ) : (
        <CustomerTable
          rows={rows}
          total={total}
          page={page}
          pageSize={pageSize}
          pageSizes={PAGE_SIZES}
          loading={loading}
          onPageChange={(p) => updateParams({ page: p === 0 ? null : String(p + 1) })}
          onPageSizeChange={(size) => updateParams({ size: size === 20 ? null : String(size), page: null })}
          selected={selected}
          onToggleRow={toggleRow}
          onToggleAllOnPage={toggleAllOnPage}
          empty={
            <EmptyState
              icon={<PersonSearchIcon />}
              title={hasFilters ? "No customers match these filters" : "No customers yet"}
              description={
                query
                  ? `Nothing matches “${query}”. Search uses an exact customer ID or part of an order category.`
                  : hasFilters
                    ? "Try another risk level."
                    : "Add a customer to run the churn model."
              }
              action={
                hasFilters ? (
                  <Button variant="outlined" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}

      <BulkSmsDialog
        key={bulkDialogKey}
        open={bulkDialogOpen}
        onClose={() => setBulkDialogOpen(false)}
        selectedIds={Array.from(selected)}
        initialRiskLevel={riskLevel}
        search={query}
        onDone={() => setSelected(new Set())}
      />
    </Box>
  );
}
