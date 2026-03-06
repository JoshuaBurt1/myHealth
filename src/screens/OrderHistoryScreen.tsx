import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { Package, Calendar, RotateCcw, Loader2 } from 'lucide-react';

const OrderHistoryScreen = () => {
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
        // We use the original item ID if available, otherwise fallback to name-based ID
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
      // Redirect to store or cart to show the added items
      navigate('/store');
    } catch (error) {
      console.error("Reorder failed:", error);
      alert("Failed to add items to cart. Please try again.");
    } finally {
      setReorderingId(null);
    }
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="animate-spin text-indigo-500" size={32} />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Order History</h1>
      
      {orders.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center">
          <Package className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500">You haven't placed any orders yet.</p>
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
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl text-sm font-bold transition-all border border-slate-100 hover:border-indigo-100 disabled:opacity-50"
              >
                {reorderingId === order.id ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <RotateCcw size={16} />
                )}
                {reorderingId === order.id ? 'Adding to Cart...' : 'Reorder All Items'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistoryScreen;