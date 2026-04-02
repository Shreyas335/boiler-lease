import { useState } from "react";
import type { ReactNode, MouseEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
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
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
import AddHomeRoundedIcon from "@mui/icons-material/AddHomeRounded";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import { useAuth } from "../contexts/AuthContext";
import AccountSettingsModal from "./AccountSettingsModal";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  function handleMenuOpen(event: MouseEvent<HTMLElement>) {
    setAnchorEl(event.currentTarget);
  }

  function handleMenuClose() {
    setAnchorEl(null);
  }

  async function handleLogout() {
    handleMenuClose();
    await logout();
    navigate("/login");
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: "background.paper",
          color: "text.primary",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Container maxWidth="lg">
          <Toolbar
            disableGutters
            sx={{ justifyContent: "space-between", py: 0.5 }}
          >
            <Button
              component={RouterLink}
              to={user ? "/dashboard" : "/"}
              startIcon={<HomeRoundedIcon />}
              sx={{
                color: "primary.main",
                fontWeight: 700,
                fontSize: "1.1rem",
              }}
            >
              Boiler Lease
            </Button>
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
              {user ? (
                <>
                  <Button
                    component={RouterLink}
                    to="/browse"
                    color="inherit"
                    startIcon={<ApartmentRoundedIcon />}
                    sx={{ color: "text.secondary" }}
                  >
                    Browse
                  </Button>
                  {user.user_type === "subleaser" && (
                    <>
                      <Button
                        component={RouterLink}
                        to="/companies"
                        color="inherit"
                        startIcon={<BusinessRoundedIcon />}
                        sx={{ color: "text.secondary" }}
                      >
                        Companies
                      </Button>
                      <Button
                        component={RouterLink}
                        to="/listings/new"
                        color="inherit"
                        startIcon={<AddHomeRoundedIcon />}
                        sx={{ color: "text.secondary" }}
                      >
                        Create Listing
                      </Button>
                      <Button
                        component={RouterLink}
                        to="/my-listings"
                        color="inherit"
                        startIcon={<ApartmentRoundedIcon />}
                        sx={{ color: "text.secondary" }}
                      >
                        My Listings
                      </Button>
                      <Button
                        component={RouterLink}
                        to="/booking-requests"
                        color="inherit"
                        startIcon={<FactCheckRoundedIcon />}
                        sx={{ color: "text.secondary" }}
                      >
                        Booking Requests
                      </Button>
                    </>
                  )}
                  {user.user_type === "sublessee" && (
                    <>
                      <Button
                        component={RouterLink}
                        to="/bookings/current"
                        color="inherit"
                        startIcon={<EventAvailableRoundedIcon />}
                        sx={{ color: "text.secondary" }}
                      >
                        Current Bookings
                      </Button>
                      <Button
                        component={RouterLink}
                        to="/bookings/past"
                        color="inherit"
                        startIcon={<HistoryRoundedIcon />}
                        sx={{ color: "text.secondary" }}
                      >
                        Past Bookings
                      </Button>
                      <Button
                        component={RouterLink}
                        to="/favorites"
                        color="inherit"
                        startIcon={<FavoriteRoundedIcon />}
                        sx={{ color: "text.secondary" }}
                      >
                        Favorites
                      </Button>
                      <Button
                        component={RouterLink}
                        to="/payments/history"
                        color="inherit"
                        startIcon={<PaymentsRoundedIcon />}
                        sx={{ color: "text.secondary" }}
                      >
                        Payments
                      </Button>
                    </>
                  )}

                  {/* Profile avatar dropdown */}
                  <IconButton
                    onClick={handleMenuOpen}
                    size="small"
                    aria-controls={menuOpen ? "profile-menu" : undefined}
                    aria-haspopup="true"
                    aria-expanded={menuOpen ? "true" : undefined}
                    sx={{ ml: 1 }}
                  >
                    <Avatar
                      sx={{
                        width: 34,
                        height: 34,
                        bgcolor: "primary.main",
                        fontSize: "0.95rem",
                        fontWeight: 600,
                      }}
                    >
                      {(user.first_name?.[0] || user.username[0]).toUpperCase()}
                    </Avatar>
                  </IconButton>

                  <Menu
                    id="profile-menu"
                    anchorEl={anchorEl}
                    open={menuOpen}
                    onClose={handleMenuClose}
                    onClick={handleMenuClose}
                    transformOrigin={{ horizontal: "right", vertical: "top" }}
                    anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                    slotProps={{
                      paper: {
                        elevation: 4,
                        sx: { minWidth: 180, mt: 1 },
                      },
                    }}
                  >
                    <Box sx={{ px: 2, py: 1 }}>
                      <Typography variant="subtitle2" noWrap>
                        {user.first_name || user.username}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                      >
                        {user.email}
                      </Typography>
                    </Box>
                    <Divider />
                    <MenuItem
                      component={RouterLink}
                      to="/account"
                    >
                      <ListItemIcon>
                        <AccountCircleRoundedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>My Account</ListItemText>
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        handleMenuClose();
                        setSettingsOpen(true);
                      }}
                    >
                      <ListItemIcon>
                        <SettingsRoundedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Settings</ListItemText>
                    </MenuItem>
                    <MenuItem
                      component={RouterLink}
                      to="/feedback"
                    >
                      <ListItemIcon>
                        <RateReviewRoundedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Feedback</ListItemText>
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={handleLogout}>
                      <ListItemIcon>
                        <LogoutRoundedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Log out</ListItemText>
                    </MenuItem>
                  </Menu>

                  <AccountSettingsModal
                    open={settingsOpen}
                    onClose={() => setSettingsOpen(false)}
                  />
                </>
              ) : (
                <>
                  <Button
                    component={RouterLink}
                    to="/browse"
                    color="inherit"
                    startIcon={<ApartmentRoundedIcon />}
                    sx={{ color: "text.secondary" }}
                  >
                    Browse
                  </Button>
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
