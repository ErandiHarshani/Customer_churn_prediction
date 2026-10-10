import { useCallback, useMemo, useState, type ReactNode } from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Slide, { type SlideProps } from "@mui/material/Slide";
import { ToastContext, type ToastApi, type ToastTone } from "./toastContext";

interface Toast {
  key: number;
  message: string;
  tone: ToastTone;
}

// Enters and exits from the same (bottom) edge, so the motion has a spatial story.
function SlideUp(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}

/** One toast at a time, bottom-centre; a new toast replaces the current one. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [open, setOpen] = useState(false);

  const show = useCallback((message: string, tone: ToastTone = "info") => {
    setToast({ key: Date.now(), message, tone });
    setOpen(true);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, "success"),
      error: (m) => show(m, "error"),
      info: (m) => show(m, "info"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        key={toast?.key}
        open={open}
        autoHideDuration={toast?.tone === "error" ? 7000 : 4000}
        onClose={(_, reason) => reason !== "clickaway" && setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        slots={{ transition: SlideUp }}
        slotProps={{ transition: { timeout: { enter: 225, exit: 160 } } }}
      >
        <Alert
          severity={toast?.tone ?? "info"}
          variant="filled"
          onClose={() => setOpen(false)}
          sx={{ minWidth: 280, boxShadow: 3 }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}
