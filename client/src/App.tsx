/*
 * iParkBayan — App.tsx (Fixed Route Priority & Background Auto Updater)
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// 🔥 1. IDINAGDAG: Import natin yung Auto Updater (Make sure tama yung path kung saan mo sinave!)
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
import DigitalReceiptPage from "./pages/driver/DigitalReceipt"; 
import MyReservationsPage from "./pages/driver/MyReservationsPage";
import ProfilePage from "./pages/driver/ProfilePage";
import VehiclesPage from "./pages/driver/VehiclesPage";
import NotificationsPage from "./pages/driver/NotificationsPage";

// Admin Pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminParkingSlots from "./pages/admin/AdminParkingSlots";
import AdminReservations from "./pages/admin/AdminReservations";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";

function Router() {
  return (
    <Switch>
      {/* 1. Splash Screen (Ang entry point ng app) */}
      <Route path="/" component={SplashScreen} />

      {/* 2. AUTH PAGES (Dapat laging nasa itaas ito ng dynamic routes) */}
      {/* Dito natin sinisiguro na lalabas ang Register Page */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/update-password" component={UpdatePasswordPage} />

      {/* 3. STATIC DRIVER PAGES */}
      <Route path="/home" component={DriverHome} />
      <Route path="/map" component={ParkingMapPage} />
      <Route path="/reservations" component={MyReservationsPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/vehicles" component={VehiclesPage} />
      <Route path="/notifications" component={NotificationsPage} />

      {/* 4. ADMIN SECTION */}
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/slots" component={AdminParkingSlots} />
      <Route path="/admin/reservations" component={AdminReservations} />
      <Route path="/admin/reports" component={AdminReports} />
      <Route path="/admin/settings" component={AdminSettings} />

      {/* 5. DYNAMIC ROUTES (Dapat laging nasa huli) */}
      {/* Nilalagay natin ito sa dulo para hindi nito ma-block ang /register */}
      <Route path="/parking/:id" component={ParkingLotPage} />
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
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" richColors />
          
          {/* 🔥 2. IDINAGDAG: Dito natin isiningit para tahimik siyang tumatakbo sa buong app */}
          <AutoStatusUpdater />
          
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;