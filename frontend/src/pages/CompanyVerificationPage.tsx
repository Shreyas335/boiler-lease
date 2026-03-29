import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  getCompanyStatus,
  getDocuments,
  uploadDocument,
  deleteDocument,
  type CompanyProfile,
  type CompanyDocument,
} from "../api/company";
import { useAuth } from "../contexts/AuthContext";

const DOCUMENT_TYPES = [
  { value: "business_license", label: "Business License" },
  { value: "proof_of_ownership", label: "Proof of Ownership" },
  { value: "other", label: "Other" },
];

export default function CompanyVerificationPage() {
  const { user } = useAuth();
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [docType, setDocType] = useState("business_license");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadData() {
    try {
      const [companyData, docsData] = await Promise.all([getCompanyStatus(), getDocuments()]);
      setCompany(companyData);
      setDocuments(docsData);
    } catch {
      setError("Failed to load company information.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadDocument(file, docType);
      await loadData();
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setError("Failed to delete document.");
    }
  }

  function getStatusBanner() {
    if (!company) return null;
    if (company.status === "approved") {
      return <Alert severity="success">Your company is verified and approved.</Alert>;
    }
    if (company.status === "rejected") {
      return (
        <Alert severity="error">
          <strong>Your verification was rejected.</strong>
          {company.rejection_reason && (
            <Box mt={0.5}>Reason: {company.rejection_reason}</Box>
          )}
          <Box mt={0.5}>Please upload updated documents and resubmit.</Box>
        </Alert>
      );
    }
    return (
      <Alert severity="warning">
        Your documents are under review. You will be notified once approved.
      </Alert>
    );
  }

  if (user && !user.email_verified) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning">
          You must verify your email before starting the company verification process. Please check
          your inbox for the verification link, or resend it from Account settings.
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={8}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} mb={1}>
        Company Verification
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Upload documents to verify your management company. Our team will review and approve your account.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box mb={3}>{getStatusBanner()}</Box>

      <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" fontWeight={600} mb={2}>
          Upload Document
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Document Type</InputLabel>
            <Select
              value={docType}
              label="Document Type"
              onChange={(e) => setDocType(e.target.value)}
            >
              {DOCUMENT_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Choose File"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={handleUpload}
          />
        </Stack>
        {uploadError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {uploadError}
          </Alert>
        )}
      </Paper>

      <Divider sx={{ mb: 3 }} />

      <Typography variant="h6" fontWeight={600} mb={2}>
        Uploaded Documents
      </Typography>
      {documents.length === 0 ? (
        <Typography color="text.secondary">No documents uploaded yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Filename</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Uploaded</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>{doc.original_filename}</TableCell>
                <TableCell>
                  {DOCUMENT_TYPES.find((t) => t.value === doc.document_type)?.label ?? doc.document_type}
                </TableCell>
                <TableCell>{new Date(doc.uploaded_at).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" color="error" onClick={() => handleDelete(doc.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Container>
  );
}
