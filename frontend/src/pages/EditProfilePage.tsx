import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getMyProfile, updateMyProfile, uploadProfilePicture } from "../api/profiles";
import { useAuth } from "../contexts/AuthContext";
import type { UserProfile } from "../types/profile";

export default function EditProfilePage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    bio: "",
    contact_phone: "",
    first_name: "",
    last_name: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyProfile();
        setProfile(data);
        setForm({
          bio: data.bio,
          contact_phone: data.contact_phone,
          first_name: data.first_name,
          last_name: data.last_name,
        });
      } catch {
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setSuccessMessage(null);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.bio.length > 500) {
      setError("Bio must be 500 characters or fewer.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await updateMyProfile(form);
      await refreshUser();
      navigate(`/profile/${user?.id}`);
    } catch {
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePictureUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadProfilePicture(file);
      setProfile((prev) => prev ? { ...prev, profile_picture_url: result.profile_picture_url } : prev);
      await refreshUser();
      setSuccessMessage("Profile picture updated.");
    } catch {
      setError("Failed to upload profile picture.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Typography>Loading...</Typography>
        </Container>
      </Box>
    );
  }

  const avatarLetter = (profile?.first_name?.[0] || profile?.username?.[0] || "?").toUpperCase();

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="md">
        <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
          Edit Profile
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Update your public profile information.
        </Typography>

        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Profile Picture
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                src={profile?.profile_picture_url || undefined}
                sx={{ width: 72, height: 72, bgcolor: "primary.main", fontSize: "1.75rem", fontWeight: 700 }}
              >
                {!profile?.profile_picture_url && avatarLetter}
              </Avatar>
              <Button
                variant="outlined"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Change Picture"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={handlePictureUpload}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2} component="form" onSubmit={handleSave}>
              {error && <Alert severity="error">{error}</Alert>}
              {successMessage && <Alert severity="success">{successMessage}</Alert>}

              <TextField
                label="First name"
                value={form.first_name}
                onChange={(e) => handleChange("first_name", e.target.value)}
                fullWidth
              />
              <TextField
                label="Last name"
                value={form.last_name}
                onChange={(e) => handleChange("last_name", e.target.value)}
                fullWidth
              />
              <TextField
                label="Bio"
                value={form.bio}
                onChange={(e) => handleChange("bio", e.target.value)}
                multiline
                rows={4}
                fullWidth
                inputProps={{ maxLength: 500 }}
                helperText={`${form.bio.length}/500`}
              />
              <TextField
                label="Contact phone"
                value={form.contact_phone}
                onChange={(e) => handleChange("contact_phone", e.target.value)}
                fullWidth
              />
              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate(`/profile/${user?.id}`)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="contained" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
