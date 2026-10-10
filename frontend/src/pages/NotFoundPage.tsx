import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import { Link as RouterLink } from "react-router-dom";
import { EmptyState } from "../components/PageStates";
import { usePageTitle } from "../hooks/usePageTitle";

export function NotFoundPage() {
  usePageTitle("Page not found");
  return (
    <Card variant="outlined">
      <EmptyState
        icon={<SearchOffIcon />}
        title="Page not found"
        description="This address doesn't match any page in the dashboard."
        action={
          <Button variant="contained" component={RouterLink} to="/">
            Go to dashboard
          </Button>
        }
      />
    </Card>
  );
}
