"use client";

import { forwardRef } from "react";
import MuiButton from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import type { ButtonProps as MuiButtonProps } from "@mui/material/Button";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<MuiButtonProps, "variant" | "size"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT_MAP: Record<Variant, { muiVariant: MuiButtonProps["variant"]; color: MuiButtonProps["color"] }> = {
  primary:   { muiVariant: "contained", color: "primary" },
  secondary: { muiVariant: "outlined",  color: "inherit" },
  ghost:     { muiVariant: "text",      color: "inherit" },
  danger:    { muiVariant: "outlined",  color: "error" },
  outline:   { muiVariant: "outlined",  color: "primary" },
};

const SIZE_MAP: Record<Size, MuiButtonProps["size"]> = {
  sm: "small",
  md: "medium",
  lg: "large",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "secondary", size = "md", loading, children, disabled, sx, ...props },
    ref
  ) {
    const { muiVariant, color } = VARIANT_MAP[variant];

    return (
      <MuiButton
        ref={ref}
        variant={muiVariant}
        color={color}
        size={SIZE_MAP[size]}
        disabled={disabled || loading}
        sx={sx}
        {...props}
      >
        {loading && (
          <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
        )}
        {children}
      </MuiButton>
    );
  }
);
