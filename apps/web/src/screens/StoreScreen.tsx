// StoreScreen.tsx
import React, { useState, useEffect } from 'react';
import { Loader2, Plus, Minus, Search, History, ChevronDown, ChevronRight, ShoppingCart } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, setDoc, increment, serverTimestamp, collection, onSnapshot } from 'firebase/firestore';
import CartScreen from '../componentsStore/CartScreen';
import OrderHistoryScreen from '../componentsStore/OrderHistoryScreen';
import { storeItems, type StoreItem } from '../componentsStore/storeData';

const categories: StoreItem['category'][] = [
  'Supplements', 'Diagnostic Equipment', 'Medical Supplies', 
  'Specialized Care', 'Environmental Safety', 'Personnel'
];

const StoreScreen: React.FC = () => {
  const [addingId, setAddingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New Mobile States
  const [isCartMobileOpen, setIsCartMobileOpen] = useState(false);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [cartAnimating, setCartAnimating] = useState(false);
  const [isOrdersMobileOpen, setIsOrdersMobileOpen] = useState(false);
  
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>(
    Object.fromEntries(categories.map(cat => [cat, false]))
  );

  const user = auth.currentUser;

  const [localQuantities, setLocalQuantities] = useState<Record<string, number>>(
    Object.fromEntries(storeItems.map(item => [item.id, 1]))
  );

  // Listen to Cart items to update the badge counter globally for this screen
  useEffect(() => {
    if (!user) return;
    const cartRef = collection(db, 'users', user.uid, 'cart');
    const unsubscribe = onSnapshot(cartRef, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach(doc => {
        count += doc.data().quantity || 0;
      });
      setCartItemCount(count);
    });
    return () => unsubscribe();
  }, [user]);

  // Handle auto-expansion based on search input
  useEffect(() => {
  const isSearchEmpty = searchQuery.trim() === '';
  const newExpandedState: Record<string, boolean> = {};
  
  categories.forEach(cat => {
    if (isSearchEmpty) {
      newExpandedState[cat] = false;
    } else {
      const hasMatch = storeItems.some(item => 
        item.category === cat && 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      newExpandedState[cat] = hasMatch;
    }
  });

  setExpandedCats(newExpandedState);
}, [searchQuery]);

  const toggleCategory = (cat: string) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const updateLocalQty = (id: string, delta: number) => {
    setLocalQuantities(prev => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta)
    }));
  };

  const handleAddToCart = async (item: StoreItem) => {
    if (!user) {
      alert("Please log in to add items to your cart.");
      return;
    }
    const qtyToAdd = localQuantities[item.id] || 1;
    setAddingId(item.id);
    try {
      const cartRef = doc(db, 'users', user.uid, 'cart', item.id);
      await setDoc(cartRef, {
        name: item.name,
        price: item.price,
        itemId: item.id,
        quantity: increment(qtyToAdd),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setSuccessId(item.id);
      setLocalQuantities(prev => ({ ...prev, [item.id]: 1 }));
      
      // Trigger Cart Animation
      setCartAnimating(true);
      setTimeout(() => setCartAnimating(false), 300);
      
      setTimeout(() => setSuccessId(null), 2000);
    } catch (error) {
      console.error("Error adding to cart: ", error);
    } finally {
      setAddingId(null);
    }
  };

  return (
  <div className="flex flex-col lg:flex-row gap-6 p-4 bg-slate-50 min-h-screen overflow-x-hidden">    
    <div className={`flex-1 ${!user ? 'max-w-4xl w-full' : ''}`}>      
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Health Store</h1>
          <p className="text-slate-500 mt-1">Select quantities and equip your infrastructure.</p>
        </div>
          
          {user && (
            <div className="flex flex-col items-end gap-2 shrink-0">
            {/* Mobile "Cart" Button */}
            <button 
              onClick={() => setIsCartMobileOpen(true)}
              className={`lg:hidden relative flex items-center justify-center gap-2 w-28 sm:w-32 py-3 bg-indigo-600 rounded-2xl text-sm sm:text-base font-bold text-white shadow-lg shadow-indigo-100 transition-all duration-300 active:scale-95
                ${cartAnimating ? 'scale-110 -translate-y-1 bg-indigo-500 shadow-xl' : 'hover:bg-indigo-700'}
              `}
            >
              <ShoppingCart size={20} />
              <span>Cart</span>
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-slate-50 shadow-sm animate-in zoom-in duration-200">
                  {cartItemCount}
                </span>
              )}
            </button>

            {/* Orders Button */}
            <button 
              onClick={() => {
                if (window.innerWidth < 1024) { // lg breakpoint
                  setIsOrdersMobileOpen(true);
                } else {
                  window.location.href = '/orders';
                }
              }} 
              className="flex items-center justify-center gap-2 w-28 sm:w-32 py-3 bg-white border border-slate-200 rounded-2xl text-sm sm:text-base font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all active:scale-95"
            >
              <History size={20} className="text-indigo-600" />
              <span>Orders</span>
            </button>
          </div>
          )}
        </header>
        
        {/* Search Bar */}
        <div className="relative mb-10 max-w-2xl mx-auto lg:mx-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search equipment, supplies, monitors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-sm bg-white"
          />
        </div>

        {/* Categories Loop */}
        {categories.map((cat) => {
          const filteredItems = storeItems.filter(item => 
            item.category === cat && 
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
          );

          const isOpen = expandedCats[cat];

          return (
            <section key={cat} className="mb-6">
              <button 
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between font-bold text-slate-400 uppercase text-xs tracking-widest mb-4 border-b pb-2 hover:text-slate-600 transition-colors"
              >
                <span>{cat} ({filteredItems.length})</span>
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              
              {isOpen && filteredItems.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                      <div>
                        <h3 className="font-bold text-slate-800">{item.name}</h3>
                        <p className="text-slate-500 text-xs mb-4 line-clamp-2">{item.description}</p>
                        <p className="text-indigo-600 font-bold mb-4">{item.price}</p>
                      </div>

                      <div className="flex items-center gap-3 mt-auto">
                        <div className="flex items-center bg-slate-100 rounded-xl p-1 shrink-0">
                          <button onClick={() => updateLocalQty(item.id, -1)} className="p-2 hover:bg-white rounded-lg transition-colors">
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center font-bold text-sm">{localQuantities[item.id] || 1}</span>
                          <button onClick={() => updateLocalQty(item.id, 1)} className="p-2 hover:bg-white rounded-lg transition-colors">
                            <Plus size={14} />
                          </button>
                        </div>

                        <button 
                          onClick={() => handleAddToCart(item)}
                          disabled={addingId === item.id}
                          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
                            ${successId === item.id ? 'bg-green-500 text-white' : 'bg-slate-900 text-white hover:bg-indigo-600'}`}
                        >
                          {addingId === item.id ? <Loader2 className="animate-spin" size={16}/> : 'Add'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {isOpen && filteredItems.length === 0 && searchQuery.trim() !== '' && (
                <p className="text-slate-400 text-sm italic py-2">No matches in this category.</p>
              )}
            </section>
          );
        })}
      </div>

      {/* Desktop Sidebar Cart (Hidden on Mobile) */}
      {user && (
        <aside className="hidden lg:block lg:w-96 shrink-0 border-l border-slate-200 bg-slate-50">
          {/* Remove pt-1 and change top-0 to top-4 to match the parent's p-4 offset */}
          <div className="sticky top-4 pl-6">
            <CartScreen isEmbedded={true} />
          </div>
        </aside>
      )}

      {/* Mobile Cart Drawer Overlay */}
      {isCartMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsCartMobileOpen(false)}
        />
      )}

      {/* Mobile Cart Drawer (Sliding from right) */}
      <div className={`fixed top-0 right-0 h-dvh w-[90%] max-w-90 bg-slate-50 z-50 transform transition-transform duration-300 ease-in-out lg:hidden shadow-2xl ${isCartMobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <CartScreen isEmbedded={true} onClose={() => setIsCartMobileOpen(false)} />
      </div>

      {/* Mobile Orders Drawer Overlay */}
      {isOrdersMobileOpen && (
  <div 
    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
    onClick={() => setIsOrdersMobileOpen(false)}
  />
)}

{/* Mobile Orders Drawer (Sliding from right) */}
<div className={`fixed top-0 right-0 h-dvh w-[90%] max-w-md bg-slate-50 z-50 transform transition-transform duration-300 ease-in-out lg:hidden shadow-2xl flex flex-col ${isOrdersMobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
  {/* Header inside the drawer */}
  <div className="p-4 border-b flex justify-between items-center bg-white sticky top-0 z-10 shrink-0">
    <h2 className="font-bold text-xl text-slate-900">My Orders</h2>
    <button 
      onClick={() => setIsOrdersMobileOpen(false)} 
      className="p-2 text-slate-500 font-bold hover:text-slate-800 transition-colors"
    >
      Close
    </button>
  </div>
  
  {/* Scrollable Content Area */}
  <div className="flex-1 overflow-y-auto">
    <OrderHistoryScreen isEmbedded={true} />
  </div>
</div>

    </div>
  );
};

export default StoreScreen;