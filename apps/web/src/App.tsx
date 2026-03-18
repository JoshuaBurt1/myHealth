import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { LocationProvider } from './context/LocationContext';
import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import Navbar from './components/Navbar';
import HomeScreen from './screens/HomeScreen';
import StoreScreen from './screens/StoreScreen';
import ForumScreen from './screens/ForumScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ProfileScreen from './screens/ProfileScreen';
import { GroupScreen } from './screens/GroupScreen';
import CartScreen from './componentsStore/CartScreen';
import PaymentScreen from './componentsStore/PaymentScreen';
import OrderHistoryScreen from './componentsStore/OrderHistoryScreen';
function AppContent({ user }: { user: User | null }) {
  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0 md:pt-16">
      <Navbar user={user} />
      <main className="max-w-6xl mx-auto p-4">
        <Routes>
          <Route index element={<HomeScreen />} />
          <Route path="store" element={<StoreScreen />} />
          <Route path="orders" element={user ? <OrderHistoryScreen /> : <Navigate to="/login" replace />} />
          <Route path="cart" element={user ? <CartScreen /> : <Navigate to="/login" replace />} />
          <Route path="payment" element={user ? <PaymentScreen /> : <Navigate to="/login" replace />} />
          <Route path="forum" element={<ForumScreen />} />
          <Route path="login" element={<LoginScreen />} />
          <Route path="register" element={<RegisterScreen />} />
          <Route
            path="profile/:userId"
            element={user ? <ProfileScreen /> : <Navigate to="/login" replace />}
          />
          <Route path="/group/:groupId" element={<GroupScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const paypalOptions = {
    clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID,
    currency: "USD",
    intent: "capture"
  };
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Loading session...</p>
      </div>
    );
  }
  return (
    <PayPalScriptProvider options={paypalOptions}>
      <LocationProvider>
        <Router>
          <AppContent user={user} />
        </Router>
      </LocationProvider>
    </PayPalScriptProvider>
  );
}