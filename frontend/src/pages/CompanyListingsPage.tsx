import { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Container, Typography, TextField, Tabs, Tab,
  Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, CircularProgress, Alert, Chip, Stack
} from '@mui/material';
import { getCompanyListings, type CompanyListing } from '../api/company';

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Archived', value: 'archived' },
];

const APPROVAL_CHIP_COLOR: Record<string, 'success' | 'warning' | 'default' | 'error'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'error',
  not_submitted: 'default',
};

const STATUS_CHIP_COLOR: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success',
  pending: 'warning',
  archived: 'default',
};

export default function CompanyListingsPage() {
  const [listings, setListings] = useState<CompanyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCompanyListings({
        status: statusTab || undefined,
        search: debouncedSearch || undefined,
      });
      setListings(data);
    } catch {
      setError('Failed to load listings.');
    } finally {
      setLoading(false);
    }
  }, [statusTab, debouncedSearch]);

  useEffect(() => { void fetchListings(); }, [fetchListings]);

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="lg">
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>My Listings</Typography>
        <Stack spacing={2} sx={{ mb: 3 }}>
          <TextField
            label="Search by name or address"
            value={search}
            onChange={e => setSearch(e.target.value)}
            fullWidth
            size="small"
          />
          <Tabs
            value={statusTab}
            onChange={(_, v: string) => setStatusTab(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {STATUS_TABS.map(tab => (
              <Tab key={tab.value} label={tab.label} value={tab.value} />
            ))}
          </Tabs>
        </Stack>

        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
        {error && <Alert severity="error">{error}</Alert>}
        {!loading && !error && listings.length === 0 && (
          <Alert severity="info">No listings found.</Alert>
        )}
        {!loading && !error && listings.length > 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Property Name</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell>Monthly Rent</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Approval</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listings.map(listing => (
                  <TableRow key={listing.id} hover>
                    <TableCell>
                      <RouterLink
                        to={`/properties/${listing.id}`}
                        style={{ textDecoration: 'none', color: 'inherit', fontWeight: 600 }}
                      >
                        {listing.title}
                      </RouterLink>
                    </TableCell>
                    <TableCell>{listing.street_line_1}, {listing.city}, {listing.state}</TableCell>
                    <TableCell>${listing.monthly_rent}/mo</TableCell>
                    <TableCell>
                      <Chip
                        label={listing.status}
                        size="small"
                        color={STATUS_CHIP_COLOR[listing.status] ?? 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={listing.approval_status.replace('_', ' ')}
                        size="small"
                        color={APPROVAL_CHIP_COLOR[listing.approval_status] ?? 'default'}
                      />
                    </TableCell>
                    <TableCell>{new Date(listing.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>
    </Box>
  );
}
