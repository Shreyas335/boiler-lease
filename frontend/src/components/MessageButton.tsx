import { useState } from "react";
import { Button, Snackbar, Alert } from "@mui/material";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import { checkIsBlocked } from "../api/messaging";
import NewConversationModal from "./NewConversationModal";
import { useAuth } from "../contexts/AuthContext";
import type { AxiosError } from "axios";

interface MessageButtonProps {
  recipientId: number;
  recipientName: string;
  listingId?: number;
  listingTitle?: string;
}

export default function MessageButton({
  recipientId,
  recipientName,
  listingId,
  listingTitle,
}: MessageButtonProps) {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [checkingBlock, setCheckingBlock] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  if (!user) return null;
  if (user.id === recipientId) return null;

  async function handleClick() {
    setCheckingBlock(true);
    try {
      const { is_blocked } = await checkIsBlocked(recipientId);
      if (is_blocked) {
        setSnackbar("You cannot message this user.");
      } else {
        setModalOpen(true);
      }
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      setSnackbar(axiosError.response?.data?.detail || "Something went wrong.");
    } finally {
      setCheckingBlock(false);
    }
  }

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<ChatBubbleOutlineRoundedIcon />}
        onClick={handleClick}
        disabled={checkingBlock}
        size="small"
      >
        {checkingBlock ? "Checking…" : "Message"}
      </Button>

      <NewConversationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        recipientId={recipientId}
        recipientName={recipientName}
        listingId={listingId}
        listingTitle={listingTitle}
      />

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="warning" onClose={() => setSnackbar(null)}>
          {snackbar}
        </Alert>
      </Snackbar>
    </>
  );
}
