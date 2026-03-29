import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import theme from "./theme";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import AccountPage from "./pages/AccountPage";
import HelpPage from "./pages/HelpPage";
import CreateListingPage from "./pages/CreateListingPage";
import EditListingPage from "./pages/EditListingPage";
import MyListingsPage from "./pages/MyListingsPage";
import BrowseListingsPage from "./pages/BrowseListingsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import CurrentBookingsPage from "./pages/CurrentBookingsPage";
import PastBookingsPage from "./pages/PastBookingsPage";
import FavoritesPage from "./pages/FavoritesPage";
import PropertyDetailPage from "./pages/PropertyDetailPage";
import CompanyVerificationPage from "./pages/CompanyVerificationPage";
import GuidelineSettingsPage from "./pages/GuidelineSettingsPage";
import ManagementCompaniesPage from "./pages/ManagementCompaniesPage";

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/account"
                element={
                  <ProtectedRoute>
                    <AccountPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/feedback"
                element={
                  <ProtectedRoute>
                    <HelpPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/help" element={<Navigate to="/feedback" replace />} />
              <Route
                path="/listings/new"
                element={
                  <ProtectedRoute>
                    <CreateListingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/listings/:id/edit"
                element={
                  <ProtectedRoute>
                    <EditListingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-listings"
                element={
                  <ProtectedRoute>
                    <MyListingsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/browse" element={<BrowseListingsPage />} />
              <Route
                path="/bookings/current"
                element={
                  <ProtectedRoute>
                    <CurrentBookingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bookings/past"
                element={
                  <ProtectedRoute>
                    <PastBookingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/favorites"
                element={
                  <ProtectedRoute>
                    <FavoritesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/properties/:id"
                element={
                  <ProtectedRoute>
                    <PropertyDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/company/verify"
                element={
                  <ProtectedRoute>
                    <CompanyVerificationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/company/guidelines"
                element={
                  <ProtectedRoute>
                    <GuidelineSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/companies"
                element={
                  <ProtectedRoute>
                    <ManagementCompaniesPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
