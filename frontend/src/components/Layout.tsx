import { useCallback, useEffect, useState } from "react";
import type { ReactNode, MouseEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
import AddHomeRoundedIcon from "@mui/icons-material/AddHomeRounded";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import MessageRoundedIcon from "@mui/icons-material/MessageRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import { useAuth } from "../contexts/AuthContext";
import AccountSettingsModal from "./AccountSettingsModal";
import { getUnreadCount } from "../api/messaging";
import { listOffers } from "../api/offers";
import {
  getNotifications,
  getUnreadNotifCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "../api/notifications";
import { useNotificationSocket } from "../hooks/useNotificationSocket";
import { notifDestination } from "../utils/notifDestination";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingOfferCount, setPendingOfferCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  // Bell popover
  const [bellAnchorEl, setBellAnchorEl] = useState<null | HTMLElement>(null);
  const bellOpen = Boolean(bellAnchorEl);
  const [recentNotifs, setRecentNotifs] = useState<AppNotification[]>([]);

  function handleMenuOpen(event: MouseEvent<HTMLElement>) {
    setAnchorEl(event.currentTarget);
  }

  function handleMenuClose() {
    setAnchorEl(null);
  }

  async function handleBellOpen(event: MouseEvent<HTMLElement>) {
    setBellAnchorEl(event.currentTarget);
    try {
      const notifs = await getNotifications();
      setRecentNotifs(notifs.slice(0, 8));
    } catch {
      // ignore
    }
  }

  async function handleBellClose() {
    setBellAnchorEl(null);
    // Mark all read after closing
    try {
      await markAllNotificationsRead();
      setUnreadNotifCount(0);
      setRecentNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  }

  async function handleNotifClick(n: AppNotification) {
    if (!n.is_read) {
      await markNotificationRead(n.id).catch(() => {});
      setRecentNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    setBellAnchorEl(null);
    const dest = notifDestination(n);
    if (dest) navigate(dest);
  }

  const handleIncomingNotification = useCallback((n: AppNotification) => {
    setUnreadNotifCount((prev) => prev + 1);
    setRecentNotifs((prev) => [n, ...prev].slice(0, 8));
  }, []);

  useNotificationSocket(!!user, handleIncomingNotification);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function fetchUnread() {
      try {
        const { unread_count } = await getUnreadCount();
        if (!cancelled) setUnreadCount(unread_count);
      } catch {
        // ignore
      }
    }

    async function fetchPendingOffers() {
      try {
        const offers = await listOffers("pending");
        if (!cancelled) setPendingOfferCount(offers.length);
      } catch {
        // ignore
      }
    }

    async function fetchUnreadNotifs() {
      try {
        const { unread_count } = await getUnreadNotifCount();
        if (!cancelled) setUnreadNotifCount(unread_count);
      } catch {
        // ignore
      }
    }

    fetchUnread();
    fetchPendingOffers();
    fetchUnreadNotifs();
    const interval = setInterval(() => {
      fetchUnread();
      fetchPendingOffers();
      fetchUnreadNotifs();
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

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
                  <Button
                    component={RouterLink}
                    to="/messages"
                    color="inherit"
                    startIcon={
                      <Badge badgeContent={unreadCount || 0} color="error" max={99}>
                        <MessageRoundedIcon />
                      </Badge>
                    }
                    sx={{ color: "text.secondary" }}
                  >
                    Messages
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/offers"
                    color="inherit"
                    startIcon={
                      <Badge badgeContent={pendingOfferCount || 0} color="error" max={99}>
                        <LocalOfferRoundedIcon />
                      </Badge>
                    }
                    sx={{ color: "text.secondary" }}
                  >
                    Offers
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
                      <Button
                        component={RouterLink}
                        to="/groups"
                        color="inherit"
                        startIcon={<GroupsRoundedIcon />}
                        sx={{ color: "text.secondary" }}
                      >
                        Groups
                      </Button>
                    </>
                  )}

                  {/* Bell notification icon */}
                  <IconButton size="small" onClick={handleBellOpen} sx={{ ml: 0.5 }}>
                    <Badge badgeContent={unreadNotifCount || 0} color="error" max={99}>
                      {unreadNotifCount > 0 ? (
                        <NotificationsRoundedIcon fontSize="small" />
                      ) : (
                        <NotificationsNoneRoundedIcon fontSize="small" />
                      )}
                    </Badge>
                  </IconButton>

                  {/* Notification popover */}
                  <Popover
                    open={bellOpen}
                    anchorEl={bellAnchorEl}
                    onClose={handleBellClose}
                    anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                    transformOrigin={{ horizontal: "right", vertical: "top" }}
                    slotProps={{ paper: { sx: { width: 340, mt: 1 } } }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight={700}>Notifications</Typography>
                      <Button size="small" component={RouterLink} to="/notifications" onClick={() => setBellAnchorEl(null)}>
                        View all
                      </Button>
                    </Stack>
                    <Divider />
                    {recentNotifs.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2, textAlign: "center" }}>
                        No notifications yet.
                      </Typography>
                    ) : (
                      recentNotifs.map((n, i) => (
                        <Box key={n.id}>
                          <Box
                            onClick={() => handleNotifClick(n)}
                            sx={{
                              px: 2,
                              py: 1,
                              cursor: "pointer",
                              bgcolor: n.is_read ? "transparent" : "action.hover",
                              "&:hover": { bgcolor: "action.selected" },
                              display: "flex",
                              gap: 1,
                              alignItems: "flex-start",
                            }}
                          >
                            {!n.is_read && (
                              <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "primary.main", mt: 0.7, flexShrink: 0 }} />
                            )}
                            {n.is_read && <Box sx={{ width: 7, flexShrink: 0 }} />}
                            <Box>
                              <Typography variant="body2" fontWeight={n.is_read ? 400 : 600} noWrap>
                                {n.title}
                              </Typography>
                              <Typography variant="caption" color="text.disabled">
                                {new Date(n.created_at).toLocaleString()}
                              </Typography>
                            </Box>
                          </Box>
                          {i < recentNotifs.length - 1 && <Divider />}
                        </Box>
                      ))
                    )}
                  </Popover>

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
                      src={user.profile_picture_url || undefined}
                      sx={{
                        width: 34,
                        height: 34,
                        bgcolor: "primary.main",
                        fontSize: "0.95rem",
                        fontWeight: 600,
                      }}
                    >
                      {!user.profile_picture_url && (user.first_name?.[0] || user.username[0]).toUpperCase()}
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
                      to={`/profile/${user.id}`}
                    >
                      <ListItemIcon>
                        <PersonRoundedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>My Profile</ListItemText>
                    </MenuItem>
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
                      to="/settings/privacy"
                    >
                      <ListItemIcon>
                        <LockRoundedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Privacy</ListItemText>
                    </MenuItem>
                    <MenuItem
                      component={RouterLink}
                      to="/settings/notifications"
                    >
                      <ListItemIcon>
                        <NotificationsNoneRoundedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Notification Settings</ListItemText>
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
