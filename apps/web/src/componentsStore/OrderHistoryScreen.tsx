import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { Package, Calendar, RotateCcw } from 'lucide-react';

// Added interface for TypeScript prop safety
interface OrderHistoryProps {
  isEmbedded?: boolean;
}

const OrderHistoryScreen = ({ isEmbedded = false }: OrderHistoryProps) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ordersRef = collection(db, 'users', user.uid, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
  }, []);

  const handleReorder = async (order: any) => {
    const user = auth.currentUser;
    if (!user) return;

    setReorderingId(order.id);
    const batch = writeBatch(db);

    try {
      order.items.forEach((item: any) => {
        const itemId = item.id || item.itemId || item.name.replace(/\s+/g, '-').toLowerCase();
        const cartRef = doc(db, 'users', user.uid, 'cart', itemId);
        
        batch.set(cartRef, {
          name: item.name,
          price: item.price,
          itemId: itemId,
          quantity: increment(item.quantity),
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      // If embedded in a drawer, we might want to close the drawer first, 
      // but usually navigating to store/cart works well.
      navigate('/store');
    } catch (error) {
      console.error("Reorder failed:", error);
      alert("Failed to add items to cart.");
    } finally {
      setReorderingId(null);
    }
  };

  // --- SKELETON COMPONENT ---
  const OrderSkeleton = () => (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-pulse">
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-2">
          <div className="h-3 w-24 bg-slate-100 rounded" />
          <div className="h-5 w-32 bg-slate-200 rounded" />
        </div>
        <div className="h-8 w-20 bg-indigo-50 rounded-full" />
      </div>
      <div className="space-y-3 mb-6">
        <div className="h-4 w-full bg-slate-50 rounded" />
        <div className="h-4 w-3/4 bg-slate-50 rounded" />
      </div>
      <div className="h-10 w-full bg-slate-100 rounded-xl" />
    </div>
  );

  return (
    /* Conditional Class: Removes max-width and centering if embedded in a drawer */
    <div className={`${isEmbedded ? 'w-full' : 'max-w-2xl mx-auto'} p-4`}>
      
      {/* Conditional Title: Only show the main heading if NOT embedded */}
      {!isEmbedded && (
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Order History</h1>
      )}
      
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => <OrderSkeleton key={n} />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center">
          <Package className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500 font-medium">No orders found yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                    <Calendar size={14} />
                    {order.createdAt?.toDate().toLocaleDateString('en-US', { 
                      month: 'long', day: 'numeric', year: 'numeric' 
                    })}
                  </div>
                  <p className="font-bold text-slate-900">Order #{order.orderId?.slice(-8) || order.id.slice(-8)}</p>
                </div>
                <div className="text-right">
                  <span className="block bg-indigo-50 text-indigo-600 text-sm font-bold px-3 py-1 rounded-full mb-2">
                    ${order.total.toFixed(2)}
                  </span>
                </div>
              </div>
              
              <div className="border-t border-slate-50 pt-4 mb-4">
                {order.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm text-slate-600 mb-1">
                    <span>{item.quantity} × {item.name}</span>
                    <span className="text-slate-400">{item.price}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleReorder(order)}
                disabled={reorderingId === order.id}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all border 
                  ${reorderingId === order.id 
                    ? 'bg-indigo-50 text-indigo-400 border-indigo-100 animate-pulse cursor-wait' 
                    : 'bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border-slate-100 hover:border-indigo-100'}`}
              >
                <RotateCcw size={16} className={reorderingId === order.id ? 'animate-spin' : ''} />
                {reorderingId === order.id ? 'Processing...' : 'Reorder All Items'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistoryScreen;