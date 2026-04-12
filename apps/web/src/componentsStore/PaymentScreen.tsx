import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, onSnapshot, doc, writeBatch, serverTimestamp } from 'firebase/firestore'; 
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { PayPalButtons } from "@paypal/react-paypal-js";

interface CartItem {id: string; name: string; price: string; quantity: number; }

const PaymentScreen: React.FC = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const cartRef = collection(db, 'users', user.uid, 'cart');
    return onSnapshot(cartRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CartItem[];
      
      const total = items.reduce((acc, item) => {
        const price = parseFloat(item.price.replace(/[$,]/g, ''));
        return acc + (price * item.quantity);
      }, 0);

      setCartItems(items);
      setSubtotal(total);
    });
  }, []);

  const handleSuccessfulPayment = async (details: any) => {
    const user = auth.currentUser;
    if (!user) return;

    setIsProcessing(true);
    const batch = writeBatch(db);
    const orderRef = doc(collection(db, 'users', user.uid, 'orders'));

    batch.set(orderRef, {
      items: cartItems,
      total: subtotal,
      orderId: details.id,
      status: 'completed',
      createdAt: serverTimestamp(),
    });

    cartItems.forEach((item) => {
      const cartItemRef = doc(db, 'users', user.uid, 'cart', item.id);
      batch.delete(cartItemRef);
    });

    try {
      await batch.commit();
      setIsSuccess(true);
    } catch (error) {
      console.error("Error finalizing order:", error);
      alert("Order processed but failed to update history. Please contact support.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-100 shadow-xl text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 mx-auto">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Order Confirmed!</h2>
          <p className="text-slate-500 mt-2">Thank you for your purchase. Your order history has been updated.</p>
          <button onClick={() => navigate('/store')} className="mt-8 w-full py-3 bg-slate-900 text-white rounded-xl font-bold active:scale-95 transition-transform">
            Return to Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 relative">
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
            <p className="font-bold text-slate-800">Finalizing your order...</p>
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto">
        <button 
          onClick={() => navigate(-1)} 
          disabled={isProcessing}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-8 transition-colors disabled:opacity-50"
        >
          <ArrowLeft size={20} /> Back to Cart
        </button>

        <h1 className="text-3xl font-bold text-slate-900 mb-8">Payment</h1>

        <div className="grid gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Order Summary</p>
            <p className="text-2xl font-bold text-slate-800">Total Due: ${subtotal.toFixed(2)}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-75">
            <PayPalButtons 
              style={{ layout: "vertical", shape: "pill" }}
              disabled={isProcessing}
              createOrder={(_, actions) => actions.order.create({
                intent: "CAPTURE",
                purchase_units: [{ amount: { currency_code: "USD", value: subtotal.toFixed(2) } }]
              })}
              onApprove={async (_, actions) => {
                const details = await actions.order?.capture();
                if (details) {
                  await handleSuccessfulPayment(details);
                }
              }}
            />
            <p className="text-[10px] text-center text-slate-400 mt-4">
              Secure encryption powered by PayPal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentScreen;