import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeModeProvider } from "./context/ThemeModeContext";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CustomerListPage } from "./pages/CustomerListPage";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { NewCustomerPage } from "./pages/NewCustomerPage";
import { SmsGatewaySettingsPage } from "./pages/SmsGatewaySettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ToastProvider } from "./components/feedback/ToastProvider";
import { ConfirmProvider } from "./components/feedback/ConfirmProvider";

function App() {
  return (
    <ThemeModeProvider>
      <ToastProvider>
      <ConfirmProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/customers" element={<CustomerListPage />} />
                <Route path="/customers/new" element={<NewCustomerPage />} />
                <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
                <Route path="/settings/sms-gateway" element={<SmsGatewaySettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      </ConfirmProvider>
      </ToastProvider>
    </ThemeModeProvider>
  );
}

export default App;
