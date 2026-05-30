"use client";

import { Component, ReactNode } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import MuiButton from "@mui/material/Button";
import Typography from "@mui/material/Typography";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          <AlertTitle>An unexpected error occurred in the video pipeline.</AlertTitle>
          <Typography variant="caption" sx={{ wordBreak: "break-all", display: "block", mb: 1.5 }}>
            {this.state.error.message}
          </Typography>
          <MuiButton variant="outlined" size="small" color="error" onClick={this.reset}>
            Try again
          </MuiButton>
        </Alert>
      );
    }
    return this.props.children;
  }
}
