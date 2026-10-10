import { useEffect } from "react";

/** Sets the browser tab title, e.g. "Customers · Churn Prediction". */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Churn Prediction` : "Churn Prediction";
  }, [title]);
}
