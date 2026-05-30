"use client";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import CloseOutlined from "@mui/icons-material/CloseOutlined";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
}

const WIDTH_MAP: Record<string, "xs" | "sm" | "md" | "lg"> = {
  sm: "xs",
  md: "sm",
  lg: "md",
  xl: "lg",
};

export function Modal({ open, onClose, title, children, width = "md" }: ModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={WIDTH_MAP[width]}
      fullWidth
    >
      {title && (
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontWeight: 600,
            fontSize: "1rem",
            py: 2,
            pr: 1.5,
          }}
        >
          {title}
          <IconButton onClick={onClose} size="small" aria-label="Close">
            <CloseOutlined fontSize="small" />
          </IconButton>
        </DialogTitle>
      )}
      <DialogContent sx={{ pt: title ? 0 : 3 }}>
        {children}
      </DialogContent>
    </Dialog>
  );
}
