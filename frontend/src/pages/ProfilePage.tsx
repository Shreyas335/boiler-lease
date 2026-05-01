import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Rating from "@mui/material/Rating";
import type { UserProfile } from "../types/profile";
import {
  getUserProfile,
  rateUser,
  blockUser,
  unblockUser,
} from "../api/profiles";
import { useAuth } from "../contexts/AuthContext";

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [pendingReview, setPendingReview] = useState<string>("");
  const [reviewDirty, setReviewDirty] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const userId = Number(id);
  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const data = await getUserProfile(userId);
        setProfile(data);
        setPendingScore(data.my_rating);
        setPendingReview(data.my_review ?? "");
      } catch {
        setError("User not found.");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [userId]);

  async function handleSubmitReview() {
    if (!profile || !pendingScore) return;
    setRatingLoading(true);
    try {
      const result = await rateUser(userId, pendingScore, pendingReview);
      setProfile(result);
      setReviewDirty(false);
    } catch {
      // ignore
    } finally {
      setRatingLoading(false);
    }
  }

  async function handleBlockToggle() {
    if (!profile) return;
    setBlockLoading(true);
    try {
      if (profile.is_blocked) {
        await unblockUser(userId);
        setProfile((prev) => prev ? { ...prev, is_blocked: false } : prev);
      } else {
        await blockUser(userId);
        setProfile((prev) => prev ? { ...prev, is_blocked: true } : prev);
      }
    } catch {
      // ignore
    } finally {
      setBlockLoading(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Typography>Loading profile...</Typography>
        </Container>
      </Box>
    );
  }

  if (error || !profile) {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Alert severity="error">{error ?? "User not found."}</Alert>
        </Container>
      </Box>
    );
  }

  const displayName =
    profile.first_name || profile.last_name
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : profile.username;

  const avatarLetter = (profile.first_name?.[0] || profile.username[0]).toUpperCase();

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Stack direction="row" spacing={3} alignItems="center">
            <Avatar
              src={profile.profile_picture_url || undefined}
              sx={{ width: 80, height: 80, bgcolor: "primary.main", fontSize: "2rem", fontWeight: 700 }}
            >
              {!profile.profile_picture_url && avatarLetter}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h5" fontWeight={700}>
                  {displayName}
                </Typography>
                <Chip label={profile.user_type} size="small" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                @{profile.username}
              </Typography>
            </Box>
            {isOwnProfile && (
              <Button variant="outlined" onClick={() => navigate("/profile/edit")}>
                Edit Profile
              </Button>
            )}
          </Stack>

          {profile.bio && (
            <Box>
              <Typography variant="body1">{profile.bio}</Typography>
            </Box>
          )}

          {profile.contact_phone && (
            <Typography variant="body2" color="text.secondary">
              Phone: {profile.contact_phone}
            </Typography>
          )}

          <Divider />

          <Box>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              Rating
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Rating value={profile.average_rating ?? 0} precision={0.1} readOnly />
              <Typography variant="body2" color="text.secondary">
                {profile.average_rating !== null
                  ? profile.average_rating.toFixed(1)
                  : "No ratings"}{" "}
                ({profile.rating_count} {profile.rating_count === 1 ? "rating" : "ratings"})
              </Typography>
            </Stack>

            {!isOwnProfile && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {profile.my_rating ? "Your rating:" : "Leave a rating:"}
                </Typography>
                <Rating
                  value={pendingScore ?? 0}
                  onChange={(_, v) => { setPendingScore(v); setReviewDirty(true); }}
                  disabled={ratingLoading}
                />
                {(pendingScore || reviewDirty) && (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <TextField
                      label="Review (optional)"
                      multiline
                      minRows={2}
                      value={pendingReview}
                      onChange={e => { setPendingReview(e.target.value); setReviewDirty(true); }}
                      size="small"
                      fullWidth
                    />
                    <Box>
                      <Button
                        variant="contained"
                        size="small"
                        disabled={ratingLoading || !pendingScore}
                        onClick={() => void handleSubmitReview()}
                      >
                        {profile.my_rating ? "Update review" : "Submit review"}
                      </Button>
                    </Box>
                  </Stack>
                )}
              </Box>
            )}
          </Box>

          {profile.reviews.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                  Reviews
                </Typography>
                <Stack spacing={2}>
                  {profile.reviews.map((r) => (
                    <Box key={r.id} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Rating value={r.score} readOnly size="small" />
                        <Typography variant="body2" fontWeight={600}>{r.rater_display}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(r.created_at).toLocaleDateString()}
                        </Typography>
                      </Stack>
                      {r.review && (
                        <Typography variant="body2" color="text.secondary">{r.review}</Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Box>
            </>
          )}

          {!isOwnProfile && (
            <>
              <Divider />
              <Box>
                <Button
                  variant={profile.is_blocked ? "outlined" : "contained"}
                  color={profile.is_blocked ? "inherit" : "error"}
                  onClick={handleBlockToggle}
                  disabled={blockLoading}
                >
                  {profile.is_blocked ? "Unblock User" : "Block User"}
                </Button>
              </Box>
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
