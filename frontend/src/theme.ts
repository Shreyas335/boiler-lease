import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#000000", // Purdue Black
      light: "#333333",
      dark: "#000000",
    },
    secondary: {
      main: "#CFB991", // Purdue Old Gold
      light: "#E5D4B1",
      dark: "#B8860B",
    },
    background: {
      default: "#fafafa",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    h3: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        },
      },
    },
  },
});

export default theme;
