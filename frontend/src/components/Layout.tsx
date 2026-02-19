import { ReactNode } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  Container,
} from "@mui/material";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import { useAuth } from "../contexts/AuthContext";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
            <Box sx={{ display: "flex", gap: 1 }}>
              {user ? (
                <>
                  <Typography variant="body2" sx={{ alignSelf: "center", mr: 1, color: "text.secondary" }}>
                    {user.first_name || user.username}
                  </Typography>
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
