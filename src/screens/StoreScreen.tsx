import React, { useState } from 'react';
import { Loader2, Plus, Minus, Search, History } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import CartScreen from './CartScreen';
import { Link } from 'react-router-dom';

interface StoreItem {
  id: string;
  name: string;
  description: string;
  category: 'Supplements' | 'Diagnostic Equipment' | 'Medical Supplies' | 'Specialized Care' | 'Environmental Safety' | 'Personnel';
  price: string;
}

const storeItems: StoreItem[] = [
  // Supplements
  { id: 's1', name: 'Multivitamin', category: 'Supplements', price: '$24.99', description: 'Daily essential nutrients to support overall health and immune function.' },
  { id: 's2', name: 'Protein Powder', category: 'Supplements', price: '$45.00', description: 'High-quality protein source for muscle recovery and nutritional supplementation.' },
  
  // Diagnostic Equipment
  { id: 'd1', name: 'Blood Glucose Tester', category: 'Diagnostic Equipment', price: '$29.99', description: 'Digital meter for monitoring blood sugar levels in real-time.' },
  { id: 'd2', name: 'Blood Glucose Strips', category: 'Diagnostic Equipment', price: '$15.00', description: 'Compatible test strips for accurate glucose level measurement.' },
  { id: 'd3', name: 'Pulse Oximeter', category: 'Diagnostic Equipment', price: '$19.00', description: 'Non-invasive device to measure oxygen saturation and heart rate.' },
  { id: 'd4', name: 'Automatic Blood Pressure Cuff', category: 'Diagnostic Equipment', price: '$49.99', description: 'Upper-arm monitor for quick and accurate blood pressure readings.' },
  { id: 'd5', name: 'Portable EKG/ECG Monitor', category: 'Diagnostic Equipment', price: '$89.00', description: 'Compact device for recording heart rhythm and detecting irregularities.' },
  { id: 'd6', name: 'Digital Stethoscope', category: 'Diagnostic Equipment', price: '$299.00', description: 'Amplified heart and lung sounds with visual waveform display and recording capabilities.' },
  { id: 'd7', name: 'Handheld Ultrasound', category: 'Diagnostic Equipment', price: '$1,850.00', description: 'Portable imaging probe that connects to mobile devices for real-time internal visualization.' },
  { id: 'd8', name: 'Mouth Thermometer', category: 'Diagnostic Equipment', price: '$12.50', description: 'Fast-acting digital thermometer for accurate body temperature monitoring.' },
  { id: 'd9', name: 'Smart Pill Dispenser', category: 'Diagnostic Equipment', price: '$120.00', description: 'Automated organizer with alerts to ensure consistent medication timing.' },
  { id: 'd10', name: 'Medical Alert Bracelet', category: 'Diagnostic Equipment', price: '$25.00', description: 'Wearable identifier to communicate critical health info in emergencies.' },
  
  // Medical Supplies
  { id: 'm1', name: 'First Aid Kit', category: 'Medical Supplies', price: '$35.00', description: 'Comprehensive emergency response kit for minor injuries and wound care.' },
  { id: 'm2', name: 'Gauze Pads', category: 'Medical Supplies', price: '$8.50', description: 'Sterile absorbent pads for cleaning and protecting wounds.' },
  { id: 'm3', name: 'Packing Gauze', category: 'Medical Supplies', price: '$12.00', description: 'Long-strip cotton gauze designed for packing deep wounds and managing drainage.' },
  { id: 'm4', name: 'Iodine Antiseptic Solution', category: 'Medical Supplies', price: '$11.00', description: 'Povidone-iodine solution for topical skin preparation and infection prevention in minor cuts.' },
  { id: 'm5', name: 'Kling Wrap', category: 'Medical Supplies', price: '$5.00', description: 'Conforming stretch bandage used to hold primary dressings in place.' },
  { id: 'm6', name: 'Pressure Wrap', category: 'Medical Supplies', price: '$12.00', description: 'Elastic compression bandage to reduce swelling and support joints.' },

  // Specialized Care
  { id: 'sc1', name: 'Aero Chamber', category: 'Specialized Care', price: '$30.00', description: 'Valved holding chamber to improve effective delivery of inhaler medication.' },
  { id: 'sc2', name: 'Catheter Bag', category: 'Specialized Care', price: '$18.00', description: 'Standard drainage bag with secure anti-reflux valves for hygiene.' },
  { id: 'sc3', name: 'Ostomy Kit (Small)', category: 'Specialized Care', price: '$45.00', description: 'Compact pouching system including skin barrier and adhesive for pediatric or low-profile use.' },
  { id: 'sc4', name: 'Ostomy Kit (Medium)', category: 'Specialized Care', price: '$48.00', description: 'Standard-sized pouching system with a flexible skin barrier for daily management and comfort.' },
  { id: 'sc5', name: 'Ostomy Kit (Large)', category: 'Specialized Care', price: '$52.00', description: 'High-capacity pouching system designed for extended wear and secure effluent management.' },
  
  // Environmental Safety
  { id: 'e1', name: 'Masks (N95/KN95)', category: 'Environmental Safety', price: '$15.00', description: 'High-filtration respirators to protect against airborne particles.' },
  { id: 'e2', name: 'Surgical Masks', category: 'Environmental Safety', price: '$8.00', description: 'Standard 3-ply disposable masks for general fluid resistance and breathability.' },
  { id: 'e3', name: 'Gloves (Nitrile)', category: 'Environmental Safety', price: '$12.00', description: 'Powder-free, latex-free gloves for sterile handling and protection.' },
  { id: 'e4', name: 'Standard Exam Gloves', category: 'Environmental Safety', price: '$9.00', description: 'Ambidextrous vinyl or latex-free gloves for non-sterile everyday protection.' },
  { id: 'e5', name: 'Face Shield', category: 'Environmental Safety', price: '$7.00', description: 'Transparent barrier to protect the face from splashes and debris.' },
  { id: 'e6', name: 'Yellow Isolation Gown', category: 'Environmental Safety', price: '$22.00', description: 'Fluid-resistant protective apparel with elastic cuffs for full-body coverage.' },
  { id: 'e7', name: 'TDS Meter', category: 'Environmental Safety', price: '$14.00', description: 'Tester for Total Dissolved Solids to check drinking water purity.' },
  { id: 'e8', name: 'Water Filter System', category: 'Environmental Safety', price: '$150.00', description: 'Multi-stage filtration system to remove contaminants from tap water.' },
  { id: 'e9', name: 'Indoor Air Quality Monitor', category: 'Environmental Safety', price: '$95.00', description: 'Sensors for CO2, VOCs, and particulate matter levels in your home.' },
  { id: 'e10', name: 'Radon Detector', category: 'Environmental Safety', price: '$130.00', description: 'Continuous monitoring device for detecting dangerous radon gas levels.' },
  { id: 'e11', name: 'Geiger Counter', category: 'Environmental Safety', price: '$180.00', description: 'Professional-grade instrument for measuring ionizing radiation.' },
  { id: 'e12', name: 'Handheld Spectrometer', category: 'Environmental Safety', price: '$450.00', description: 'Advanced tool for analyzing light spectra and material composition.' },
  
  // Personnel
  { id: 'p1', name: 'Robot Healthcare Worker', category: 'Personnel', price: '$12,500.00', description: 'Autonomous AI assistant for patient monitoring and basic care tasks.' },
];

const categories: StoreItem['category'][] = [
  'Supplements', 'Diagnostic Equipment', 'Medical Supplies', 
  'Specialized Care', 'Environmental Safety', 'Personnel'
];

const StoreScreen: React.FC = () => {
  const [addingId, setAddingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Track auth state to handle centering and cart visibility
  const user = auth.currentUser;

  const [localQuantities, setLocalQuantities] = useState<Record<string, number>>(
    Object.fromEntries(storeItems.map(item => [item.id, 1]))
  );

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
      setTimeout(() => setSuccessId(null), 2000);
      
    } catch (error) {
      console.error("Error adding to cart: ", error);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className={`flex flex-col lg:flex-row gap-6 p-4 bg-slate-50 min-h-screen ${!user ? 'justify-center' : ''}`}>
      <div className={`flex-1 ${!user ? 'max-w-4xl w-full mx-auto' : ''}`}>
        <header className={`mb-8 flex justify-between items-start ${!user ? 'text-center' : ''}`}>
          <div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Health Store</h1>
            <p className="text-slate-500 mt-1">Select quantities and equip your infrastructure.</p>
          </div>
          {user && (
            <Link 
              to="/orders" 
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <History size={18} />
              Orders
            </Link>
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
            (item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
             item.description.toLowerCase().includes(searchQuery.toLowerCase()))
          );

          if (filteredItems.length === 0) return null;

          return (
            <section key={cat} className="mb-12">
              <h2 className={`font-bold text-slate-400 uppercase text-xs tracking-widest mb-6 border-b pb-2 ${!user ? 'text-center' : ''}`}>{cat}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </section>
          );
        })}
        
        {/* Empty State for Search */}
        {storeItems.filter(item => 
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          item.description.toLowerCase().includes(searchQuery.toLowerCase())
        ).length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <p className="text-lg font-medium">No items found matching "{searchQuery}"</p>
            <button onClick={() => setSearchQuery('')} className="mt-4 text-indigo-600 hover:underline">Clear search</button>
          </div>
        )}
      </div>

      {user && (
        <aside className="lg:w-96 w-full shrink-0">
          <div className="lg:sticky lg:top-20">
            <CartScreen isEmbedded={true} />
          </div>
        </aside>
      )}
    </div>
  );
};

export default StoreScreen;