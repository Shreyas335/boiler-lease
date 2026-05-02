import { useState, useEffect } from 'react';
import {
  Card, CardContent, Typography, TextField,
  Button, Alert, Stack, CircularProgress, Box
} from '@mui/material';
import { getFeeConfig, updateFeeConfig } from '../api/company';

export default function FeeConfigSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [feePercentage, setFeePercentage] = useState('');
  const [feeFlat, setFeeFlat] = useState('');

  useEffect(() => {
    getFeeConfig()
      .then(cfg => {
        setFeePercentage(cfg.platform_fee_percentage ?? '');
        setFeeFlat(cfg.platform_fee_flat ?? '');
      })
      .catch(() => setError('Failed to load fee config.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateFeeConfig({
        platform_fee_percentage: feePercentage !== '' ? feePercentage : null,
        platform_fee_flat: feeFlat !== '' ? feeFlat : null,
      });
      setSuccess(true);
    } catch {
      setError('Failed to save fee config. Please check your values.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2 }}>Management Fee Configuration</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          These fees are charged to sublessees for listings managed by your company. Existing confirmed bookings
          are not retroactively affected.
        </Typography>
        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">Fee configuration saved.</Alert>}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Management Fee (%)"
                value={feePercentage}
                onChange={e => { setFeePercentage(e.target.value); setSuccess(false); }}
                type="number"
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                placeholder="e.g. 5.00"
                size="small"
                sx={{ width: 200 }}
              />
              <TextField
                label="Management Flat Fee ($)"
                value={feeFlat}
                onChange={e => { setFeeFlat(e.target.value); setSuccess(false); }}
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
                placeholder="e.g. 50.00"
                size="small"
                sx={{ width: 200 }}
              />
            </Box>
            <Box>
              <Button
                variant="contained"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Fee Config'}
              </Button>
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
