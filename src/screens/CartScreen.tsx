import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Trash2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { PayPalButtons } from "@paypal/react-paypal-js";

interface CartItem {
  id: string;
  name: string;
  price: string;
  quantity: number;
}

interface CartProps {
  isEmbedded?: boolean;
}

const CartScreen: React.FC<CartProps> = ({ isEmbedded = false }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const cartRef = collection(db, 'users', user.uid, 'cart');
    const unsubscribe = onSnapshot(cartRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CartItem[];
      setCartItems(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const parsePrice = (priceStr: string) => parseFloat(priceStr.replace(/[$,]/g, ''));
  const subtotal = cartItems.reduce((acc, item) => acc + (parsePrice(item.price) * item.quantity), 0);

  const removeItem = async (itemId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'cart', itemId));
  };

  const clearCart = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    const batch = writeBatch(db);
    cartItems.forEach((item) => {
      const docRef = doc(db, 'users', user.uid, 'cart', item.id);
      batch.delete(docRef);
    });
    await batch.commit();
  };

  if (loading) return (
    <div className="flex h-48 items-center justify-center bg-transparent">
      <div className="animate-pulse text-slate-400">Loading cart...</div>
    </div>
  );

  if (isSuccess) return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
      <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
        <CheckCircle2 size={32} />
      </div>
      <h2 className="text-2xl font-bold text-slate-900">Order Confirmed!</h2>
      <p className="text-slate-500 mt-2">Thank you for your purchase. Your health infrastructure is being prepared.</p>
      <button 
        onClick={() => { setIsSuccess(false); setShowPayment(false); }}
        className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm"
      >
        Back to Store
      </button>
    </div>
  );

  return (
    <div className={`${isEmbedded ? 'p-0' : 'p-6'} bg-transparent h-full flex flex-col`}>
      <header className="mb-6 flex items-center gap-3">
        {showPayment && (
          <button onClick={() => setShowPayment(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
        )}
        <h1 className={`${isEmbedded ? 'text-xl' : 'text-3xl'} font-bold text-slate-900`}>
          {showPayment ? 'Payment' : 'Cart'}
        </h1>
      </header>

      {!showPayment ? (
        <>
          <div className={`flex flex-col gap-3 ${isEmbedded ? 'max-h-[50vh] overflow-y-auto pr-2 mb-4' : ''}`}>
            {cartItems.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center">
                <p className="text-slate-500 font-medium">Your cart is empty.</p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center group">
                  <div className="flex-1 pr-4">
                    <p className="font-bold text-sm text-slate-800 line-clamp-1">{item.name}</p>
                    <p className="text-xs text-indigo-600 font-semibold mt-0.5">{item.quantity} × {item.price}</p>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-lg">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-lg mt-auto">
            <div className="flex justify-between mb-3 text-sm text-slate-400">
              <span>Subtotal</span>
              <span>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t border-slate-700 pt-3">
              <span>Total</span>
              <span className="text-indigo-400">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <button 
              disabled={cartItems.length === 0}
              onClick={() => setShowPayment(true)}
              className="w-full mt-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl font-bold text-sm transition-colors active:scale-95"
            >
              Checkout Securely
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Order Summary</p>
             <p className="text-lg font-bold text-slate-800">Total Due: ${subtotal.toFixed(2)}</p>
          </div>

          <div className="min-h-75">
            <PayPalButtons 
              style={{ layout: "vertical", shape: "pill", label: "checkout" }}
              createOrder={(_data, actions) => {
                return actions.order.create({
                  intent: "CAPTURE",
                  purchase_units: [{
                    amount: {
                      currency_code: "USD",
                      value: subtotal.toFixed(2),
                    },
                    shipping: {
                      type: "SHIPPING"
                    }
                  }],
                  // application_context must be outside purchase_units
                  application_context: {
                    shipping_preference: "GET_FROM_FILE",
                    user_action: "PAY_NOW"
                  }
                });
              }}
              onApprove={async (_data, actions) => {
                return actions.order?.capture().then(async (details) => {
                  console.log("Transaction completed by " + details.payer?.name?.given_name);
                  await clearCart();
                  setIsSuccess(true);
                });
              }}
            />
          </div>
          <p className="text-[10px] text-center text-slate-400 px-4">
            Secure encryption powered by PayPal. No payment data is stored on our servers.
          </p>
        </div>
      )}
    </div>
  );
};

export default CartScreen;