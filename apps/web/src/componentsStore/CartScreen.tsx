  // CartScreen.tsx
  import React, { useEffect, useState } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { db, auth } from '../firebase';
  import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
  import { Trash2, X } from 'lucide-react';

  interface CartItem {
    id: string;
    name: string;
    price: string;
    quantity: number;
  }

  interface CartScreenProps {
    isEmbedded?: boolean;
    onClose?: () => void; 
  }

  const CartScreen: React.FC<CartScreenProps> = ({ isEmbedded = false, onClose }) => {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
      const user = auth.currentUser;
      if (!user) return;

      const cartRef = collection(db, 'users', user.uid, 'cart');
      return onSnapshot(cartRef, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CartItem[];
        setCartItems(items);
        setLoading(false);
      });
    }, []);

    const parsePrice = (priceStr: string) => parseFloat(priceStr.replace(/[$,]/g, ''));
    const subtotal = cartItems.reduce((acc, item) => acc + (parsePrice(item.price) * item.quantity), 0);

    const removeItem = async (itemId: string) => {
      const user = auth.currentUser;
      if (!user) return;
      await deleteDoc(doc(db, 'users', user.uid, 'cart', itemId));
    };

    if (loading) return <div className="p-10 text-center animate-pulse text-slate-400">Loading cart...</div>;

    return (
      <div className={`${isEmbedded ? 'pt-0 px-4 pb-4 h-full' : 'p-6 h-screen'} bg-transparent flex flex-col overflow-hidden`}>
        <header className="mb-6 flex justify-between items-center shrink-0">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Cart</h1>
          {onClose && (
            <button onClick={onClose} className="p-2 bg-slate-200 text-slate-600 rounded-full hover:bg-slate-300 transition-colors">
              <X size={18} strokeWidth={2.5}/>
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto pr-1 pb-4 hide-scrollbar">
          <div className="flex flex-col gap-3">
            {cartItems.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center">
                <p className="text-slate-500 font-medium">Your cart is empty.</p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center transition-all active:scale-[0.98]">
                  <div className="flex-1">
                    <p className="font-bold text-sm text-slate-800">{item.name}</p>
                    <p className="text-xs text-indigo-600 font-semibold">{item.quantity} × {item.price}</p>
                  </div>
                  <button 
                    onClick={() => removeItem(item.id)} 
                    className="text-slate-300 hover:text-red-500 p-2 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {cartItems.length > 0 && (
          <div className="bg-slate-900 p-5 rounded-2xl text-white shadow-lg shrink-0 mt-2 mb-2">
            <div className="flex justify-between font-bold text-lg border-b border-slate-700 pb-3 mb-4">
              <span>Total</span>
              <span className="text-indigo-400">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <button onClick={() => navigate('/payment')}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-50 rounded-xl font-bold text-sm transition-transform active:scale-95"
            >
              Checkout Securely
            </button>
          </div>
        )}
      </div>
    );
  };

  export default CartScreen;