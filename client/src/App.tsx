/*
 * iParkBayan — App.tsx (Fixed Route Priority & Background Auto Updater)
 * Added hash detection for invitation links.
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Auto Updater
import AutoStatusUpdater from "./components/AutoStatusUpdater"; 

// Driver App Pages
import SplashScreen from "./pages/driver/SplashScreen";
import LoginPage from "./pages/driver/LoginPage";
import RegisterPage from "./pages/driver/RegisterPage";
import UpdatePasswordPage from "./pages/driver/UpdatePasswordPage";
import DriverHome from "./pages/driver/DriverHome";
import ParkingMapPage from "./pages/driver/ParkingMapPage";
import ParkingLotPage from "./pages/driver/ParkingLotPage";
import ReservationPage from "./pages/driver/ReservationPage";
import ReservationConfirmPage from "./pages/driver/ReservationConfirmPage";
import SlotSelectionPage from "./pages/driver/SlotSelectionPage";
import DigitalReceiptPage from "./pages/driver/DigitalReceipt"; 
import BookingPage from "./pages/driver/BookingPage";
import ProfilePage from "./pages/driver/ProfilePage";
import VehiclesPage from "./pages/driver/VehiclesPage";
import NotificationsPage from "./pages/driver/NotificationsPage";
import VerificationPage from "./pages/driver/VerificationPage";
import TermsPage from "./pages/driver/TermsPage";
import ExtensionPaymentPage from "./pages/driver/ExtendPaymentPage";

// Admin Pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminParkingLots from "./pages/admin/AdminParkingLots";
import AdminParkingSlots from "./pages/admin/AdminParkingSlots";
import AdminReservations from "./pages/admin/AdminReservations";
import AdminReports from "./pages/admin/AdminReports";
import AdminPersonnel from "./pages/admin/AdminPersonnel";
import AdminScanner from "./pages/admin/AdminScanner";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminVerifications from "./pages/admin/AdminVerificationsPage";
import AdminStaffManagement from "./pages/admin/AdminStaffManagement";
import AdminTermsPage from "./pages/admin/AdminTermsPage";
import SetPasswordPage from "./pages/admin/SetPasswordPage";
import AuthCallback from "./pages/auth/authCallback";

function Router() {
  return (
    <Switch>
      {/* 1. Splash Screen (Ang entry point ng app) */}
      <Route path="/" component={SplashScreen} />

      {/* 2. AUTH PAGES */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/update-password" component={UpdatePasswordPage} />
      <Route path="/admin/terms" component={AdminTermsPage} />
      <Route path="/auth/callback" component={AuthCallback} />



      {/* 3. STATIC DRIVER PAGES */}
      <Route path="/home" component={DriverHome} />
      <Route path="/map" component={ParkingMapPage} />
      <Route path="/reservations" component={BookingPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/vehicles" component={VehiclesPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/driver/verification" component={VerificationPage} />
      <Route path="/payment/extension" component={ExtensionPaymentPage} />

      {/* 4. ADMIN SECTION */}
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/lots" component={AdminParkingLots} />
      <Route path="/admin/slots" component={AdminParkingSlots} />
      <Route path="/admin/reservations" component={AdminReservations} />
      <Route path="/admin/reports" component={AdminReports} />
      <Route path="/admin/personnel" component={AdminPersonnel} />
      <Route path="/admin/scanner" component={AdminScanner} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/verifications" component={AdminVerifications} />
      <Route path="/admin/staffmanagement" component={AdminStaffManagement} />
      <Route path="/set-password" component={SetPasswordPage} />

      {/* 5. DYNAMIC ROUTES */}
      <Route path="/parking/:id" component={ParkingLotPage} />
      <Route path="/slotselection/:lotId"> 
        {(params) => <SlotSelectionPage lotId={params.lotId} />} 
      </Route>
      <Route path="/reserve/:slotId" component={ReservationPage} />
      <Route path="/reserve/:slotId/confirm" component={ReservationConfirmPage} />
      <Route path="/receipt/:id" component={DigitalReceiptPage} />

      {/* 6. FALLBACK */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Get the full current URL
  const url = window.location.href;
  const hash = window.location.hash;
  const searchParams = new URLSearchParams(window.location.search);
  const hasTokenInHash = hash && hash.includes("access_token");
  const hasTokenInQuery = searchParams.has("token") || searchParams.has("access_token");

  if (hasTokenInHash || hasTokenInQuery) {
    // Immediately render AuthCallback to handle the token
    return (
      <ErrorBoundary>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster position="top-center" richColors />
            <AuthCallback />
          </TooltipProvider>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // Normal app rendering
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" richColors />
          <AutoStatusUpdater />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
export default App;