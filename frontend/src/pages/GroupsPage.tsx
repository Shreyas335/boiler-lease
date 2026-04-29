import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Container, Divider, Grid, Stack, TextField, Typography } from "@mui/material";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import { createDepositCheckoutSession } from "../api/payments";
import {
  acceptBookingGroupInvitation,
  confirmGroupBooking,
  createBookingGroup,
  getBookingGroup,
  getBookingGroups,
  inviteBookingGroupMembers,
  sendGroupBookingReminders,
  type BookingGroup,
} from "../api/groups";
import { useAuth } from "../contexts/AuthContext";

function splitInvitees(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export default function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<BookingGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [invitees, setInvitees] = useState("");
  const [inviteMore, setInviteMore] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadGroups(openGroupId?: number) {
    setLoading(true);
    const list = await getBookingGroups();
    const nextSelectedId = openGroupId ?? selectedGroupId ?? list[0]?.id ?? null;
    if (nextSelectedId) {
      const detailed = await getBookingGroup(nextSelectedId);
      setGroups(list.map((group) => (group.id === detailed.id ? detailed : group)));
      setSelectedGroupId(detailed.id);
    } else {
      setGroups(list);
      setSelectedGroupId(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadGroups().catch(() => {
      setMessage({ type: "error", text: "Unable to load groups." });
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateGroup() {
    try {
      setBusy(true);
      setMessage(null);
      const group = await createBookingGroup({ name, invitees: splitInvitees(invitees) });
      setName("");
      setInvitees("");
      await loadGroups(group.id);
      setMessage({ type: "success", text: "Group created." });
    } catch {
      setMessage({ type: "error", text: "Unable to create group. Check the invitees and try again." });
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(groupId: number) {
    try {
      setBusy(true);
      setMessage(null);
      await inviteBookingGroupMembers(groupId, splitInvitees(inviteMore));
      setInviteMore("");
      await loadGroups(groupId);
      setMessage({ type: "success", text: "Invitation sent." });
    } catch {
      setMessage({ type: "error", text: "Unable to invite those users." });
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept(membershipId: number, groupId: number) {
    setBusy(true);
    await acceptBookingGroupInvitation(membershipId);
    await loadGroups(groupId);
    setBusy(false);
  }

  async function handleConfirm(bookingId: number, groupId: number) {
    setBusy(true);
    await confirmGroupBooking(bookingId);
    await loadGroups(groupId);
    setBusy(false);
  }

  async function handlePay(bookingId: number) {
    setBusy(true);
    const { checkout_url } = await createDepositCheckoutSession(bookingId);
    window.location.assign(checkout_url);
  }

  async function handleRemind(bookingId: number) {
    setBusy(true);
    const response = await sendGroupBookingReminders(bookingId);
    setMessage({ type: "success", text: response.detail });
    setBusy(false);
  }

  if (!user || user.user_type !== "sublessee") {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Alert severity="error">Only sublessees can use groups.</Alert>
        </Container>
      </Box>
    );
  }

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="lg">
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Groups</Typography>
            <Typography variant="body2" color="text.secondary">
              Create a group, invite sublessees, confirm bookings, and split deposit payments.
            </Typography>
          </Box>

          {message && <Alert severity={message.type}>{message.text}</Alert>}

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Create Group</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField label="Group name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      label="Invite by email or username"
                      value={invitees}
                      onChange={(e) => setInvitees(e.target.value)}
                      placeholder="alex@example.com, taylor"
                      fullWidth
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<GroupAddRoundedIcon />}
                      onClick={handleCreateGroup}
                      disabled={busy || !name.trim()}
                      fullWidth
                      sx={{ height: "100%" }}
                    >
                      Create
                    </Button>
                  </Grid>
                </Grid>
              </Stack>
            </CardContent>
          </Card>

          {loading ? (
            <Typography>Loading groups...</Typography>
          ) : groups.length === 0 ? (
            <Alert severity="info">No groups yet.</Alert>
          ) : (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack spacing={1}>
                  {groups.map((group) => {
                    const myMembership = group.memberships.find((member) => member.user_id === user.id);
                    return (
                      <Card key={group.id} variant={selectedGroupId === group.id ? "elevation" : "outlined"}>
                        <CardContent>
                          <Stack spacing={1}>
                            <Button onClick={() => loadGroups(group.id)} sx={{ justifyContent: "flex-start", px: 0 }}>
                              {group.name}
                            </Button>
                            <Stack direction="row" spacing={1}>
                              <Chip size="small" label={`${group.memberships.filter((m) => m.status === "confirmed").length} confirmed`} />
                              {myMembership?.status === "invited" && <Chip size="small" color="warning" label="Invitation" />}
                            </Stack>
                            {myMembership?.status === "invited" && (
                              <Button size="small" onClick={() => handleAccept(myMembership.id, group.id)} disabled={busy}>
                                Accept
                              </Button>
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 8 }}>
                {selectedGroup && (
                  <Card>
                    <CardContent>
                      <Stack spacing={2}>
                        <Typography variant="h6">{selectedGroup.name}</Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {selectedGroup.memberships.map((member) => (
                            <Chip
                              key={member.id}
                              label={`${member.display_name} (${member.status})`}
                              color={member.status === "confirmed" ? "success" : "default"}
                              size="small"
                            />
                          ))}
                        </Stack>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <TextField
                            label="Invite more"
                            value={inviteMore}
                            onChange={(e) => setInviteMore(e.target.value)}
                            placeholder="email or username"
                            fullWidth
                          />
                          <Button onClick={() => handleInvite(selectedGroup.id)} disabled={busy || !inviteMore.trim()}>
                            Invite
                          </Button>
                        </Stack>
                        <Divider />
                        <Typography variant="h6">Bookings</Typography>
                        {selectedGroup.bookings?.length ? (
                          <Stack spacing={1.5}>
                            {selectedGroup.bookings.map((booking) => {
                              const confirmed = booking.group_confirmed_user_ids.includes(user.id);
                              const paid = booking.group_paid_user_ids.includes(user.id);
                              const canPay = (booking.status === "confirmed" || booking.status === "partially_paid") && !paid;
                              return (
                                <Card key={booking.id} variant="outlined">
                                  <CardContent>
                                    <Stack spacing={1}>
                                      <Stack direction="row" justifyContent="space-between" gap={1}>
                                        <Box>
                                          <Typography sx={{ fontWeight: 700 }}>{booking.listing.title}</Typography>
                                          <Typography variant="body2" color="text.secondary">
                                            {booking.start_date} to {booking.end_date}
                                          </Typography>
                                        </Box>
                                        <Chip label={booking.status_label} size="small" />
                                      </Stack>
                                      <Typography variant="body2">
                                        Confirmed by {booking.group_confirmed_user_ids.length} member(s). Paid by {booking.group_paid_user_ids.length} member(s).
                                      </Typography>
                                      <Stack direction="row" spacing={1} flexWrap="wrap">
                                        <Button
                                          size="small"
                                          startIcon={<CheckCircleRoundedIcon />}
                                          onClick={() => handleConfirm(booking.id, selectedGroup.id)}
                                          disabled={busy || confirmed}
                                        >
                                          {confirmed ? "Confirmed" : "Confirm"}
                                        </Button>
                                        <Button
                                          size="small"
                                          startIcon={<PaymentsRoundedIcon />}
                                          onClick={() => handlePay(booking.id)}
                                          disabled={busy || !canPay}
                                        >
                                          {paid ? "Paid" : "Pay Share"}
                                        </Button>
                                        <Button
                                          size="small"
                                          startIcon={<NotificationsActiveRoundedIcon />}
                                          onClick={() => handleRemind(booking.id)}
                                          disabled={busy || booking.status === "fully_paid"}
                                        >
                                          Remind
                                        </Button>
                                      </Stack>
                                    </Stack>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </Stack>
                        ) : (
                          <Alert severity="info">No group bookings yet. Choose this group when booking a listing.</Alert>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                )}
              </Grid>
            </Grid>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
