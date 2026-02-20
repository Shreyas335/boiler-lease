import { useState } from "react";
import type { ReactNode } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  Container,
  IconButton,
} from "@mui/material";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import { useAuth } from "../contexts/AuthContext";
import AccountSettingsModal from "./AccountSettingsModal";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="static" elevation={0} sx={{ bgcolor: "background.paper", color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ justifyContent: "space-between", py: 0.5 }}>
            <Button
              component={RouterLink}
              to={user ? "/dashboard" : "/"}
              startIcon={<HomeRoundedIcon />}
              sx={{ color: "primary.main", fontWeight: 700, fontSize: "1.1rem" }}
            >
              Boiler Lease
            </Button>
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
              {user ? (
                <>
                  <Typography variant="body2" sx={{ alignSelf: "center", mr: 0.5, color: "text.secondary" }}>
                    {user.first_name || user.username}
                  </Typography>
                  <Button
                    component={RouterLink}
                    to="/account"
                    color="inherit"
                    startIcon={<AccountCircleRoundedIcon />}
                    sx={{ color: "text.secondary" }}
                  >
                    Account
                  </Button>
                  <IconButton
                    aria-label="Account settings"
                    onClick={() => setSettingsOpen(true)}
                    sx={{ color: "text.secondary" }}
                  >
                    <SettingsRoundedIcon />
                  </IconButton>
                  <AccountSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
                  <Button
                    color="inherit"
                    startIcon={<LogoutRoundedIcon />}
                    onClick={handleLogout}
                    sx={{ color: "text.secondary" }}
                  >
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    component={RouterLink}
                    to="/login"
                    startIcon={<LoginRoundedIcon />}
                    color="inherit"
                    sx={{ color: "text.secondary" }}
                  >
                    Log in
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/register"
                    variant="contained"
                    startIcon={<PersonAddRoundedIcon />}
                  >
                    Sign up
                  </Button>
                </>
              )}
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
      <Box component="main" sx={{ flex: 1 }}>
        {children}
      </Box>
    </Box>
  );
}
