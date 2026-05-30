"use client";

import { useEffect, useState } from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  type: ToastType;
  text: string;
}

let _add: ((type: ToastType, text: string) => void) | null = null;

export function toast(type: ToastType, text: string) {
  _add?.(type, text);
}
export const toastSuccess = (text: string) => toast("success", text);
export const toastError   = (text: string) => toast("error", text);

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    let counter = 0;
    _add = (type, text) => {
      const id = ++counter;
      setToasts((prev) => [...prev, { id, type, text }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    };
    return () => { _add = null; };
  }, []);

  return (
    <>
      {toasts.map((t, i) => (
        <Snackbar
          key={t.id}
          open
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          sx={{ bottom: { xs: `${24 + i * 64}px !important` } }}
        >
          <Alert
            severity={t.type}
            variant="filled"
            sx={{ width: "100%", fontSize: "0.8125rem" }}
            onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          >
            {t.text}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
}
