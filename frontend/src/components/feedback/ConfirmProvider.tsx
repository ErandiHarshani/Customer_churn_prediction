import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { ConfirmContext, type ConfirmOptions } from "./confirmContext";

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) => {
      close(false); // a newer prompt cancels an older one instead of orphaning it
      setOptions(opts);
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
      });
    },
    [close],
  );

  // Back/Forward while a prompt is open means the user left that page:
  // cancel, so "Send" can never act on a customer that is no longer on screen.
  useEffect(() => {
    const cancel = () => close(false);
    window.addEventListener("popstate", cancel);
    return () => window.removeEventListener("popstate", cancel);
  }, [close]);

  const danger = options?.tone === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!options} onClose={() => close(false)} maxWidth="xs" fullWidth aria-labelledby="confirm-title">
        <DialogTitle id="confirm-title">{options?.title}</DialogTitle>
        {options?.body && (
          <DialogContent>
            {typeof options.body === "string" ? (
              <Typography variant="body2" color="text.secondary">
                {options.body}
              </Typography>
            ) : (
              options.body
            )}
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {/* for risky actions Enter should cancel, not confirm */}
          <Button onClick={() => close(false)} autoFocus={danger}>
            {options?.cancelText ?? "Cancel"}
          </Button>
          <Button
            variant="contained"
            color={danger ? "warning" : "primary"}
            onClick={() => close(true)}
            autoFocus={!danger}
          >
            {options?.confirmText ?? "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
