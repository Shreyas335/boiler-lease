import { useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import ReplayIcon from "@mui/icons-material/Replay";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import {
  uploadListingMedia,
  deleteListingMedia,
  reorderListingMedia,
  type ListingMedia,
} from "../api/listings";

export interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  mediaId?: number;
}

interface PhotoManagerProps {
  listingId: number | null;
  existingMedia: ListingMedia[];
  onExistingMediaChange: (media: ListingMedia[]) => void;
  newPhotos: PendingPhoto[];
  onNewPhotosChange: (photos: PendingPhoto[]) => void;
  uploading: boolean;
  onUploadingChange: (uploading: boolean) => void;
  onError?: (message: string) => void;
}

let nextPhotoId = 0;

export default function PhotoManager({
  listingId,
  existingMedia,
  onExistingMediaChange,
  newPhotos,
  onNewPhotosChange,
  uploading,
  onUploadingChange,
  onError,
}: PhotoManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [savingOrder, setSavingOrder] = useState(false);

  // --- File selection ---

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const pending: PendingPhoto[] = Array.from(files).map((file) => ({
      id: String(++nextPhotoId),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "queued" as const,
      progress: 0,
    }));
    onNewPhotosChange([...newPhotos, ...pending]);
    e.target.value = "";
  }

  function removeNewPhoto(photoId: string) {
    const photo = newPhotos.find((p) => p.id === photoId);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    onNewPhotosChange(newPhotos.filter((p) => p.id !== photoId));
  }

  function retryPhoto(photoId: string) {
    onNewPhotosChange(
      newPhotos.map((p) =>
        p.id === photoId ? { ...p, status: "queued" as const, progress: 0, error: undefined } : p,
      ),
    );
  }

  // --- Delete existing ---

  async function handleDeleteExisting(mediaId: number) {
    setDeletingIds((prev) => new Set(prev).add(mediaId));
    try {
      await deleteListingMedia(mediaId);
      const updated = existingMedia.filter((m) => m.id !== mediaId);
      onExistingMediaChange(updated);
    } catch {
      onError?.("Failed to delete photo.");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(mediaId);
        return next;
      });
    }
  }

  // --- Reorder existing ---

  function moveExisting(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= existingMedia.length) return;
    const next = [...existingMedia];
    [next[index], next[target]] = [next[target], next[index]];
    // Reassign display_order based on position
    const reordered = next.map((m, i) => ({ ...m, display_order: i }));
    onExistingMediaChange(reordered);
  }

  function setPrimary(mediaId: number) {
    const updated = existingMedia.map((m) => ({
      ...m,
      is_primary: m.id === mediaId,
    }));
    onExistingMediaChange(updated);
  }

  // --- Save order to backend ---

  async function saveOrder() {
    if (!listingId || existingMedia.length === 0) return;
    setSavingOrder(true);
    try {
      const order = existingMedia.map((m, i) => ({
        id: m.id,
        display_order: i,
        is_primary: m.is_primary,
      }));
      const updated = await reorderListingMedia(listingId, order);
      onExistingMediaChange(updated);
    } catch {
      onError?.("Failed to save photo order.");
    } finally {
      setSavingOrder(false);
    }
  }

  // --- Upload new photos ---

  async function uploadAll() {
    if (!listingId) return;
    const toUpload = newPhotos.filter((p) => p.status === "queued" || p.status === "error");
    if (toUpload.length === 0) return;

    onUploadingChange(true);
    let currentPhotos = [...newPhotos];
    const startOrder = existingMedia.length;

    for (let i = 0; i < toUpload.length; i++) {
      const photo = toUpload[i];
      currentPhotos = currentPhotos.map((p) =>
        p.id === photo.id ? { ...p, status: "uploading" as const, progress: 50, error: undefined } : p,
      );
      onNewPhotosChange(currentPhotos);

      try {
        const isPrimary = existingMedia.length === 0 && i === 0 && !existingMedia.some((m) => m.is_primary);
        const media = await uploadListingMedia(listingId, photo.file, startOrder + i, isPrimary);
        currentPhotos = currentPhotos.map((p) =>
          p.id === photo.id ? { ...p, status: "done" as const, progress: 100, mediaId: media.id } : p,
        );
        onNewPhotosChange(currentPhotos);
        onExistingMediaChange([...existingMedia, media]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        currentPhotos = currentPhotos.map((p) =>
          p.id === photo.id ? { ...p, status: "error" as const, progress: 0, error: message } : p,
        );
        onNewPhotosChange(currentPhotos);
      }
    }

    onUploadingChange(false);
  }

  const hasQueued = newPhotos.some((p) => p.status === "queued" || p.status === "error");
  const hasFailedPhotos = newPhotos.some((p) => p.status === "error");

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Photos</Typography>

      {/* Existing photos with reorder controls */}
      {existingMedia.length > 0 && (
        <>
          <Typography variant="body2" color="text.secondary">
            Current photos ({existingMedia.length}) — use arrows to reorder, star to set primary
          </Typography>
          <Grid container spacing={2}>
            {existingMedia.map((m, index) => (
              <Grid key={m.id} size={{ xs: 6, sm: 4, md: 3 }}>
                <Card
                  variant="outlined"
                  sx={{
                    position: "relative",
                    border: m.is_primary ? "2px solid" : undefined,
                    borderColor: m.is_primary ? "primary.main" : undefined,
                  }}
                >
                  <Box
                    component="img"
                    src={m.access_url || m.file_url || ""}
                    alt={m.original_filename || "Photo"}
                    sx={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                  />
                  {m.is_primary && (
                    <Chip
                      label="Primary"
                      color="primary"
                      size="small"
                      sx={{ position: "absolute", top: 4, left: 4, height: 20, fontSize: "0.65rem" }}
                    />
                  )}
                  <Box sx={{ px: 0.5, py: 0.5 }}>
                    <Typography variant="caption" noWrap display="block">
                      {m.original_filename || `Photo ${index + 1}`}
                    </Typography>
                    <Stack direction="row" alignItems="center" justifyContent="center" spacing={0}>
                      <IconButton
                        size="small"
                        onClick={() => moveExisting(index, -1)}
                        disabled={index === 0 || savingOrder}
                        title="Move left"
                      >
                        <ArrowBackIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => setPrimary(m.id)}
                        color={m.is_primary ? "primary" : "default"}
                        title={m.is_primary ? "Primary photo" : "Set as primary"}
                      >
                        {m.is_primary ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => moveExisting(index, 1)}
                        disabled={index === existingMedia.length - 1 || savingOrder}
                        title="Move right"
                      >
                        <ArrowForwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteExisting(m.id)}
                        disabled={deletingIds.has(m.id)}
                        title="Delete photo"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    {deletingIds.has(m.id) && <LinearProgress sx={{ mt: 0.5 }} />}
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Button
            variant="outlined"
            size="small"
            onClick={saveOrder}
            disabled={savingOrder}
            sx={{ alignSelf: "flex-start" }}
          >
            {savingOrder ? "Saving..." : "Save photo order"}
          </Button>
        </>
      )}

      {/* Add new photos */}
      <Typography variant="body2" color="text.secondary">
        Add new photos
      </Typography>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={handleFilesSelected}
      />
      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          variant="outlined"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          Select photos
        </Button>
        {hasQueued && listingId && (
          <Button
            variant="contained"
            size="small"
            onClick={uploadAll}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload selected"}
          </Button>
        )}
        {hasFailedPhotos && (
          <Button
            variant="outlined"
            color="warning"
            size="small"
            onClick={() =>
              onNewPhotosChange(
                newPhotos.map((p) =>
                  p.status === "error" ? { ...p, status: "queued" as const, progress: 0, error: undefined } : p,
                ),
              )
            }
          >
            Retry failed
          </Button>
        )}
      </Stack>

      {newPhotos.length > 0 && (
        <Grid container spacing={2}>
          {newPhotos.map((photo) => (
            <Grid key={photo.id} size={{ xs: 6, sm: 4, md: 3 }}>
              <Card variant="outlined">
                <Box
                  component="img"
                  src={photo.previewUrl}
                  alt={photo.file.name}
                  sx={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                />
                <Box sx={{ px: 1, py: 0.5 }}>
                  <Typography variant="caption" noWrap>
                    {photo.file.name}
                  </Typography>
                  <Stack direction="row" alignItems="center" justifyContent="flex-end">
                    {photo.status === "error" && (
                      <IconButton size="small" onClick={() => retryPhoto(photo.id)} title="Retry">
                        <ReplayIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => removeNewPhoto(photo.id)}
                      disabled={photo.status === "uploading"}
                      title="Remove"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  {photo.status === "uploading" && (
                    <LinearProgress variant="determinate" value={photo.progress} sx={{ mt: 0.5 }} />
                  )}
                  {photo.status === "done" && (
                    <Chip label="Uploaded" color="success" size="small" sx={{ mt: 0.5 }} />
                  )}
                  {photo.status === "error" && (
                    <Chip label={photo.error || "Failed"} color="error" size="small" sx={{ mt: 0.5 }} />
                  )}
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  );
}
