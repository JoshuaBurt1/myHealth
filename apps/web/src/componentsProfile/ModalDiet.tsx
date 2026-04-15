// ModalDiet.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Apple, CheckCircle, Info, PlusCircle, AlertCircle, ChevronDown, Search, Database, Trash2 } from 'lucide-react';
import { doc, getDoc, writeBatch, serverTimestamp, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { DIET_KEY_MAP, MICRONUTRIENT_KEY_MAP, getStandardUnit } from './profileConstants';
import { InputField } from './ProfileUI';
import PrivacyWrapper from './PrivacyWrapper';

const DIET_CATEGORIES: Record<string, Record<string, string>> = {
  Macros: DIET_KEY_MAP,
  Micros: MICRONUTRIENT_KEY_MAP,
};

type DietCategory = 'Macros' | 'Micros' | 'Custom';
const CATEGORIES: DietCategory[] = ['Macros', 'Micros', 'Custom'];

const USDA_TO_APP_MAP: Record<string, string> = {
  'energy': 'calories',
  'protein': 'protein',
  'total lipid (fat)': 'fat',
  'fat': 'fat',
  'fatty acids, total saturated': 'sat_fat',
  'fatty acids, total trans': 'trans_fat',
  'carbohydrate, by difference': 'carbs',
  'carbs': 'carbs',
  'fiber, total dietary': 'fiber',
  'fiber': 'fiber',
  'sugars, total including nlea': 'sugar',
  'total sugars': 'sugar',
  'sugar': 'sugar',
  'calcium, ca': 'calcium',
  'iron, fe': 'iron',
  'sodium, na': 'sodium',
  'magnesium, mg': 'magnesium',
  'phosphorus, p': 'phosphorus',
  'potassium, k': 'potassium',
  'zinc, zn': 'zinc',
  'copper, cu': 'copper',
  'manganese, mn': 'manganese',
  'vitamin c, total ascorbic acid': 'vit_c',
  'vitamin a, iu': 'vit_a',
  'cholesterol': 'diet_cholesterol',
  'water': 'water_intake'
};

interface DietEntry {
  name: string;
  label: string;
  unit: string;
  value: string;
  isCustom: boolean;
  type: string;
}

interface FoodItem {
  listId: string;
  fdc_id?: string;
  description: string;
  category?: string;
  nutrients: Record<string, any>;
  isCustomFood?: boolean;
  customValues?: Record<string, string>;
  quantity: number;
}

interface ModalDietProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  trackedDiet: { name: string; label: string; unit?: string; type: string; isCustom?: boolean }[];
  dietInputs: Record<string, string>;
  setDietInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hiddenOther: string[];
  toggleVisibilityOther: (field: string) => void;
  handleDeleteField: (fieldLabel: string, fieldKey: string, category: 'vital' | 'diet' | 'exercise') => Promise<void>;
  isMe: boolean;
}

export const ModalDiet: React.FC<ModalDietProps> = ({
  isOpen, onClose, userId, onSuccess,
  trackedDiet, dietInputs, setDietInputs,
  hiddenOther, toggleVisibilityOther, handleDeleteField, isMe
}) => {
  const [entries, setEntries] = useState<DietEntry[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Custom tracking states
  const [selectedCategory, setSelectedCategory] = useState<DietCategory>('Macros');
  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Database Search States
  const [usdaData, setUsdaData] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedFoods, setSelectedFoods] = useState<FoodItem[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  
  // Custom Food States
  const [customFoodInput, setCustomFoodInput] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch USDA JSON data
  useEffect(() => {
    if (isOpen) {
      fetch('/total_usda_nutrients.json')
        .then(res => res.json())
        .then(data => {
          setUsdaData(data);
        })
        .catch(err => console.error("Failed to load USDA DB:", err));
    }
  }, [isOpen]);

  // Handle search querying
  useEffect(() => {
    if (!searchQuery.trim()) {
      searchResults.length && setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const results = [];
    let count = 0;

    for (const [key, value] of Object.entries(usdaData)) {
      if (count >= 30) break; // Limited for performance

      if (key.includes(query) || value.description.toLowerCase().includes(query)) {
        results.push(value);
        count++;
      }
    }
    setSearchResults(results);
  }, [searchQuery, usdaData]);

  useEffect(() => {
    const newTotals: Record<string, string> = {};

    [...trackedDiet, ...entries].forEach(metric => {
      const total = selectedFoods.reduce((sum, food) => {
        const baseVal = food.isCustomFood 
          ? extractNumber(food.customValues?.[metric.name]) 
          : getNutrientValue(food, metric.name, metric.label);
        return sum + (baseVal * (food.quantity || 0));
      }, 0);

      // Show '0' for active fields, or '' to hide them if preferred
      newTotals[metric.name] = total > 0 
        ? total.toFixed(1).replace(/\.0$/, '') 
        : '0'; 
    });

    setDietInputs(prev => ({ ...prev, ...newTotals }));
  }, [selectedFoods, entries, trackedDiet]);

  const existingKeys = useMemo(() => new Set([
    ...trackedDiet.map(d => d.name),
    ...entries.map(e => e.name)
  ]), [trackedDiet, entries]);

  const availableMetrics = useMemo(() => {
    if (selectedCategory === 'Custom') return [];
    const activeMap = DIET_CATEGORIES[selectedCategory];
    if (!activeMap) return [];
    return Object.keys(activeMap).filter(
      label => !existingKeys.has(activeMap[label])
    );
  }, [selectedCategory, existingKeys]);

  useEffect(() => {
    if (selectedCategory !== 'Custom' && availableMetrics.length > 0 && !availableMetrics.includes(selectedMetric)) {
      setSelectedMetric(availableMetrics[0]);
    }
  }, [availableMetrics, selectedMetric, selectedCategory]);

  const toggleExpansion = (listId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(listId)) next.delete(listId);
      else next.add(listId);
      return next;
    });
  };

  // Extract numeric value from the USDA string
  const extractNumber = (valString: any) => {
    if (valString === undefined || valString === null || valString === '') return 0;
    const match = valString.toString().match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  // Logic to map nutrients input fields
  const getNutrientValue = (food: FoodItem, fieldName: string, fieldLabel: string) => {
    if (food.isCustomFood) {
      return extractNumber(food.customValues?.[fieldName] || 0);
    }

    const lowerName = fieldName.toLowerCase();
    const lowerLabel = fieldLabel.toLowerCase();
    const nutrients = food.nutrients || {};

    // 1. Check direct map
    const mappedKey = Object.keys(USDA_TO_APP_MAP).find(k => USDA_TO_APP_MAP[k] === lowerName);
    if (mappedKey && nutrients[mappedKey]) {
        const valObj = nutrients[mappedKey];
        return extractNumber(typeof valObj === 'object' ? valObj.value : valObj);
    }

    // 2. Check string inclusion as fallback
    for (const [nName, nData] of Object.entries(nutrients)) {
      const valObj = typeof nData === 'object' ? (nData as any).value : nData;
      if (nName.includes(lowerLabel) || lowerLabel.includes(nName)) {
        return extractNumber(valObj);
      }
    }
    return 0;
  };

  const handleAddFoodToTempList = (food: any) => {
    const uniqueId = Math.random().toString(36).substring(2, 11);
    const newFood: FoodItem = { ...food, listId: uniqueId, quantity: 1 };
    setSelectedFoods(prev => [...prev, newFood]);
    setExpandedItems(prev => new Set(prev).add(uniqueId));

    // Add to existing tracked inputs
    setDietInputs(prev => {
      const next = { ...prev };
      trackedDiet.forEach(dt => {
        const val = getNutrientValue(newFood, dt.name, dt.label);
        if (val > 0) {
          const curr = parseFloat(next[dt.name] || '0');
          next[dt.name] = (curr + val).toFixed(1).replace(/\.0$/, '');
        }
      });
      return next;
    });

    // Add to newly defined metric inputs
    setEntries(prev => prev.map(entry => {
      const val = getNutrientValue(newFood, entry.name, entry.label);
      if (val > 0) {
        const curr = parseFloat(entry.value || '0');
        return { ...entry, value: (curr + val).toFixed(1).replace(/\.0$/, '') };
      }
      return entry;
    }));

    setSearchQuery('');
    setSearchResults([]);
    setIsSearchFocused(false);
  };

  const handleAddCustomFood = () => {
  if (!customFoodInput.trim()) return;
    const uniqueId = Math.random().toString(36).substring(2, 11);
    const newFood: FoodItem = {
      listId: uniqueId,
      description: customFoodInput.trim(),
      nutrients: {},
      isCustomFood: true,
      customValues: {},
      quantity: 1
    };
    setSelectedFoods(prev => [...prev, newFood]);
    setExpandedItems(prev => new Set(prev).add(uniqueId));
    setCustomFoodInput('');
  };

  const updateMetricTotal = (name: string, delta: number) => {    
    if (delta === 0) return;
    
    const safeParse = (val: string) => {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    };

    if (trackedDiet.some(d => d.name === name)) {
      setDietInputs(prev => {
        const curr = safeParse(prev[name] || '0');
        const newVal = Math.max(0, curr + delta);
        return { ...prev, [name]: newVal.toFixed(1).replace(/\.0$/, '') };
      });
    } else {
      setEntries(prev => prev.map(entry => {
        if (entry.name === name) {
          const curr = safeParse(entry.value || '0');
          const newVal = Math.max(0, curr + delta);
          return { ...entry, value: newVal.toFixed(1).replace(/\.0$/, '') };
        }
        return entry;
      }));
    }
  };

  const handleCustomValueChange = (listId: string, metricName: string, newValStr: string) => {
    const food = selectedFoods.find(f => f.listId === listId);
    if (!food) return;

    const oldValStr = food.customValues?.[metricName] || '';
    const oldVal = oldValStr === '' ? 0 : parseFloat(oldValStr);
    const newVal = newValStr === '' ? 0 : parseFloat(newValStr);
    const delta = newVal - oldVal;

    setSelectedFoods(prev => prev.map(f =>
      f.listId === listId
          ? { ...f, customValues: { ...(f.customValues || {}), [metricName]: newValStr } }
          : f
    ));

    if (delta !== 0) {
      updateMetricTotal(metricName, delta);    
    }
  };

  const handleRemoveFoodFromTempList = (foodToRemove: FoodItem) => {
    setSelectedFoods(prev => prev.filter(f => f.listId !== foodToRemove.listId));

    const qty = foodToRemove.quantity || 1;

    setDietInputs(prev => {
      const next = { ...prev };
      trackedDiet.forEach(dt => {
        const val = getNutrientValue(foodToRemove, dt.name, dt.label) * qty;
        if (val > 0 && next[dt.name]) {
          const curr = parseFloat(next[dt.name]);
          const newVal = Math.max(0, curr - val);
          next[dt.name] = newVal > 0 ? newVal.toFixed(1).replace(/\.0$/, '') : '';
        }
      });
      return next;
    });

    setEntries(prev => prev.map(entry => {
      const val = getNutrientValue(foodToRemove, entry.name, entry.label) * qty; 
      if (val > 0 && entry.value) {
        const curr = parseFloat(entry.value);
        const newVal = Math.max(0, curr - val);
        return { ...entry, value: newVal > 0 ? newVal.toFixed(1).replace(/\.0$/, '') : '' };
      }
      return entry;
    }));
  };

  const handleAddEntry = () => {
  if (selectedCategory !== 'Custom') {
    if (availableMetrics.length === 0) return;
    
    const activeMap = DIET_CATEGORIES[selectedCategory];
    const key = activeMap[selectedMetric];

    if (existingKeys.has(key)) return; 
    
    setEntries(prev => [...prev, {
      name: key,
      label: selectedMetric,
      unit: getStandardUnit(key),
      type: selectedCategory.toLowerCase(),
      value: '',
      isCustom: false
    }]);
  } else {
      if (!customName.trim()) return alert('Please enter a nutrient name.');
      const sanitizedKey = `custom_diet_${customName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
      if (existingKeys.has(sanitizedKey)) return alert('Metric already tracked.');

      setEntries(prev => [...prev, {
        name: sanitizedKey,
        label: customName.trim(),
        unit: customUnit.trim() || 'g',
        type: 'custom',
        value: '',
        isCustom: true
      }]);
      setCustomName('');
      setCustomUnit('');
    }
  };

  const handleQuantityChange = (listId: string, newQtyStr: string) => {
    const newQty = parseFloat(newQtyStr);
    setSelectedFoods(prev => prev.map(f => 
      f.listId === listId ? { ...f, quantity: isNaN(newQty) ? 0 : newQty } : f
    ));
  };

  const handleSaveDiet = async () => {
    const generatedMealName = selectedFoods
      .map(f => `${f.description}${f.isCustomFood ? ' (Custom)' : ''}`)
      .join(', ');

    if (selectedFoods.length === 0) {
      return alert('Please add at least one food item from the database or custom entry.');
    }

    const preparedNew: (DietEntry & { finalValue: number })[] = [];
    const preparedExist: (typeof trackedDiet[0] & { finalValue: number })[] = [];

    for (const e of entries) {
      if (e.value.trim() !== '' && !isNaN(Number(e.value)) && Number(e.value) >= 0) {
        preparedNew.push({ ...e, finalValue: Number(e.value) });
      }
    }

    for (const d of trackedDiet) {
      const val = dietInputs[d.name];
      if (val?.trim() !== '' && !isNaN(Number(val)) && Number(val) >= 0) {
        preparedExist.push({ ...d, finalValue: Number(val) });
      }
    }

    if (!preparedNew.length && !preparedExist.length) return alert('Please enter at least one valid nutritional value.');

    setSaving(true);
    try {
      const nowISO = new Date().toISOString();
      const userRootRef = doc(db, 'users', userId);
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');

      const rootSnap = await getDoc(userRootRef);
      const rootData = rootSnap.data() || {};
      
      const lastBaseUpdate = rootData.last_diet_update?.toDate()?.getTime() || 0;
      const isEligibleForBaseGems = (Date.now() - lastBaseUpdate) > 6 * 60 * 60 * 1000;

      const lastStreakUpdate = rootData.last_diet_streak_update?.toDate()?.getTime() || 0;
      const diffMs = Date.now() - lastStreakUpdate;
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      const ONE_WEEK_MS = 7 * ONE_DAY_MS;

      let currentStreak = rootData.diet_streak || 0;
      let newStreak = currentStreak;
      let streakIncremented = false;
      let streakBonus = 0;

      if (lastStreakUpdate === 0 || diffMs > ONE_WEEK_MS) {
        newStreak = 1; streakIncremented = true; streakBonus = newStreak;
      } else if (diffMs >= ONE_DAY_MS) {
        newStreak += 1; streakIncremented = true; streakBonus = newStreak;
      }

      const updateData: any = {};
      const newDefs: any[] = [];
      const mealLogEntry = { 
          mealName: generatedMealName, 
          dateTime: nowISO, 
          macros: {} as Record<string, number> 
      };

      preparedNew.forEach(e => {
        updateData[e.name] = arrayUnion({ 
            value: e.finalValue, 
            dateTime: nowISO, 
            context: generatedMealName,
            unit: e.unit 
        });
        mealLogEntry.macros[e.name] = e.finalValue;  
        newDefs.push({ 
          name: e.label, 
          key: e.name, 
          unit: e.unit, 
          type: e.type,
          isCustom: e.isCustom 
        });
      });

      preparedExist.forEach(d => {
        updateData[d.name] = arrayUnion({ 
            value: d.finalValue, 
            dateTime: nowISO, 
            context: generatedMealName,
            unit: d.unit 
        });
        mealLogEntry.macros[d.name] = d.finalValue;
      });

      updateData.diet_history = arrayUnion(mealLogEntry);
      if (newDefs.length > 0) updateData.customDietDefinitions = arrayUnion(...newDefs);

      const batch = writeBatch(db);
      batch.set(profileRef, updateData, { merge: true });

      const rootUpdates: any = {};
      let totalGemsAwarded = 0;

      if (isEligibleForBaseGems) {
        totalGemsAwarded += 10;
        rootUpdates.last_diet_update = serverTimestamp();
      }
      if (streakIncremented) {
        totalGemsAwarded += streakBonus;
        rootUpdates.diet_streak = newStreak;
        rootUpdates.last_diet_streak_update = serverTimestamp();
      }

      if (totalGemsAwarded > 0) {
        rootUpdates.gems = increment(totalGemsAwarded);
        batch.update(userRootRef, rootUpdates);
      }

      await batch.commit();

      setEntries([]);
      setSelectedFoods([]);
      setCustomFoodInput('');
      
      setDietInputs(prev => {
        const reset = { ...prev };
        preparedExist.forEach(d => { reset[d.name] = ''; });
        return reset;
      });

      const gemMessage = (streakIncremented || isEligibleForBaseGems)
        ? `\n\n💎 +${totalGemsAwarded} Gems earned!` +
          (streakIncremented ? `\n🔥 Diet Streak: ${newStreak} (+${streakBonus} bonus gems)` : '')
        : '';

      alert(`Diet logged successfully!${gemMessage}`);
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Save Error:", err);
      alert('Failed to save diet log.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] h-full sm:h-auto">        
        
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2 sm:gap-3 tracking-tight">
            <Apple className="text-emerald-500" size={24} fill="currentColor" fillOpacity={0.2} />
            LOG NUTRITION
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-6 lg:gap-8">
          
          {/* Search & Meal Name */}
          <div className="w-full lg:w-1/2 flex flex-col gap-6">
            
            {/* Database search */}
            <div className="bg-blue-50/50 p-3 sm:p-4 rounded-2xl border border-blue-100 w-full">
              <h3 className="text-xs sm:text-sm font-bold text-blue-600 mb-3 flex items-center gap-2 uppercase tracking-tight">
                <Database size={16}/> SEARCH FOOD DATABASE OR ADD CUSTOM
              </h3>
              
              <div className="relative flex flex-col gap-3" ref={searchContainerRef}>
                <div className="relative flex-1 w-full">
                  <Search size={18} className="absolute left-3 top-2.5 sm:top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search for apples, chicken, etc..."
                    className="w-full pl-9 sm:pl-10 p-2 sm:p-3 bg-white border border-blue-200 rounded-xl text-xs sm:text-sm text-slate-700 font-medium focus:outline-none focus:border-blue-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                  />
                  
                  {/* Search results dropdown */}
                  {isSearchFocused && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                      {searchResults.map((item, idx) => (
                        <button
                          key={`${item.fdc_id}-${idx}`}
                          className="w-full text-left px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-slate-50 last:border-none flex justify-between items-center"
                          onClick={() => handleAddFoodToTempList(item)}
                        >
                          <span className="truncate pr-4">{item.description}</span>
                          <span className="text-[10px] sm:text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-md whitespace-nowrap">
                            {item.category || 'Unknown'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {isSearchFocused && searchQuery && searchResults.length === 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl p-3 sm:p-4 text-center text-xs sm:text-sm text-slate-500">
                      No items found.
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Item Input */}
              <div className="flex gap-2 w-full mt-3 border-t border-blue-100/50 pt-3">
                <input
                  type="text"
                  placeholder="Enter custom food name..."
                  className="flex-1 min-w-0 p-2 sm:p-3 bg-white border border-blue-200 rounded-xl text-xs sm:text-sm text-slate-700 font-medium focus:outline-none focus:border-blue-500"
                  value={customFoodInput}
                  onChange={(e) => setCustomFoodInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomFood();
                    }
                  }}
                />
                <button
                  onClick={handleAddCustomFood}
                  className="shrink-0 px-3 py-2 sm:px-4 sm:py-2 bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-1 sm:gap-2 shadow-sm"
                >
                  <PlusCircle size={16} />
                  <span>Add Custom</span>
                </button>
              </div>

              {/* Selected Temporary List */}
              {selectedFoods.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  {selectedFoods.map((food) => {
                    const isExpanded = expandedItems.has(food.listId);
                    
                    return (
                      <div 
                        key={food.listId} 
                        className="w-full flex flex-col bg-white border border-blue-200 text-blue-700 rounded-xl shadow-sm overflow-hidden"
                      >
                        <div className="flex items-center justify-between p-2 sm:p-3">
                          <div className="flex items-center gap-2 overflow-hidden flex-1">
                            <button 
                              onClick={() => toggleExpansion(food.listId)}
                              className="p-1 hover:bg-blue-50 rounded-full transition-colors text-blue-400"
                            >
                              <ChevronDown 
                                size={16} 
                                className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                              />
                            </button>
                            <span className="font-bold text-xs sm:text-sm truncate">
                              {food.description} {food.isCustomFood && "(Custom)"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mr-2">
                            <span className="text-[10px] font-bold text-slate-400">QTY:</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              className="w-16 p-1 text-center border border-blue-200 rounded-lg text-xs font-bold text-blue-600 focus:outline-none focus:border-blue-500"
                              value={food.quantity}
                              onChange={(e) => handleQuantityChange(food.listId, e.target.value)}
                            />
                          </div>
                          
                          <button 
                            onClick={() => handleRemoveFoodFromTempList(food)}
                            className="text-blue-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Collapsible nutrient grid */}
                        {isExpanded && (
                          <div className="px-2 pb-3 sm:px-3 sm:pb-3 border-t border-blue-100 bg-white">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1 pt-2">
                              {Array.from(new Map([...trackedDiet, ...entries].map(m => [m.name, m])).values()).map((metric) => {
                                const itemValue = food.isCustomFood 
                                  ? (food.customValues?.[metric.name] || '')
                                  : getNutrientValue(food, metric.name, metric.label);

                                return (
                                  <div key={metric.name} className="flex flex-col gap-1">
                                    <label className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold">
                                      {metric.label} {metric.unit ? `(${metric.unit})` : ''}
                                    </label>
                                    
                                    {food.isCustomFood ? (
                                      <input
                                        type="number"
                                        className="p-1.5 sm:p-2 border border-slate-200 rounded-lg text-slate-700 font-medium focus:border-blue-500 focus:outline-none text-xs sm:text-sm w-full"
                                        placeholder="0"
                                        value={itemValue}
                                        onChange={(e) => {
                                          if (!e.target.value.includes('-')) {
                                            handleCustomValueChange(food.listId, metric.name, e.target.value);
                                          }
                                        }}
                                      />
                                    ) : (
                                      <div className="p-1.5 sm:p-2 border border-slate-100 bg-slate-50/50 rounded-lg text-slate-700 font-medium text-xs sm:text-sm">
                                        {itemValue || 0}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {[...trackedDiet, ...entries].length === 0 && (
                                <span className="text-slate-400 font-normal col-span-full text-[10px] sm:text-xs">
                                  Add a metric to track nutrients for this item.
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Metrics & Active Fields */}
          <div className="w-full lg:w-1/2 flex flex-col gap-6">

            {/* Diet dropdown */}
            <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-100 w-full">
              <h3 className="text-xs sm:text-sm font-bold text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-tight">
                <PlusCircle size={16}/> TRACK A NEW NUTRIENT
              </h3>      
              
              <div className="flex flex-wrap bg-slate-200/50 p-1 rounded-xl mb-4 gap-1 w-fit">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    className={`px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-black rounded-lg transition-all ${
                      selectedCategory === cat ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:bg-slate-200'
                    }`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {selectedCategory !== 'Custom' ? (
                  <div className="relative flex-1" ref={dropdownRef}>
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full flex items-center justify-between p-2 sm:p-3 bg-white border border-slate-200 rounded-xl text-slate-700 text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500 transition-all"
                    >
                      <span className="truncate">
                        {selectedMetric || (availableMetrics.length === 0 ? `All metrics tracked` : 'Select Metric')}
                      </span>
                      <ChevronDown size={18} className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && availableMetrics.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 sm:mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                        <div className="max-h-60 overflow-y-auto">
                          {availableMetrics.map((met) => (
                            <button
                              key={met}
                              className="w-full text-left px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors border-b border-slate-50 last:border-none"
                              onClick={() => {
                                setSelectedMetric(met);
                                setIsDropdownOpen(false);
                              }}
                            >
                              {met}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Nutrient (e.g., Vitamin C)"
                      className="flex-1 p-2 sm:p-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Unit (mg, mcg)"
                      className="w-24 sm:w-32 p-2 sm:p-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500"
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                    />
                  </>
                )}
                
                <button
                  onClick={handleAddEntry}
                  className="px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-black text-[10px] sm:text-xs text-white bg-slate-800 hover:bg-slate-900 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                >
                  ADD TO GRID
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-500 mb-3 sm:mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Info size={16}/> ACTIVE NUTRITION FIELDS
              </h3>

              {(trackedDiet.length === 0 && entries.length === 0) ? (
                <div className="text-center p-6 sm:p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400">
                  <AlertCircle size={28} className="mx-auto mb-2 opacity-50"/>
                  <p className="text-xs sm:text-sm font-medium">No diet metrics tracked yet. Add one above.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {CATEGORIES.map(category => {
                    const categoryType = category.toLowerCase();
                    
                    const existingInCat = trackedDiet.filter(dt => dt.type === categoryType || (category === 'Custom' && dt.isCustom));
                    const newInCat = entries.filter(e => (e.type === categoryType || (category === 'Custom' && e.isCustom)) && !trackedDiet.some(dt => dt.name === e.name));

                    if (existingInCat.length === 0 && newInCat.length === 0) return null;

                    return (
                      <div key={category} className="w-full">
                        <h4 className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest border-b border-slate-100 pb-1">
                          {category}
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-4">
                          
                          {/* Existing metrics for this category */}
                          {existingInCat.map((dt, idx) => (
                            <PrivacyWrapper
                              key={`exist-${dt.name}-${idx}`}
                              fieldKey={dt.name}
                              isMe={isMe}
                              hiddenOther={hiddenOther}
                              toggleVisibilityOther={toggleVisibilityOther}
                              onDelete={async () => {
                                await handleDeleteField(dt.label, dt.name, 'diet');
                              }}
                            >
                              <div className="h-full w-full bg-slate-50/50 rounded-2xl border border-slate-100 p-2 flex flex-col justify-center">
                                <span className="text-[10px] sm:text-xs font-bold text-slate-500 mb-1 sm:mb-2 truncate block w-full px-1 uppercase tracking-tight">
                                  {dt.label}
                                </span>
                                <div className="cursor-default select-none pointer-events-none">
                                  <InputField
                                    label={`Total ${dt.unit ? `(${dt.unit})` : ''}`.trim()}
                                    type="text"
                                    value={dietInputs[dt.name] || ''} 
                                    onChange={() => {}}
                                    disabled={false} 
                                    icon={<div className="w-4" />} 
                                  />
                                </div>
                              </div>
                            </PrivacyWrapper>
                          ))}

                          {/* New metrics for this category */}
                          {newInCat.map((entry) => (
                            <PrivacyWrapper
                              key={`new-${entry.name}`}
                              fieldKey={entry.name}
                              isMe={isMe}
                              hiddenOther={hiddenOther}
                              toggleVisibilityOther={toggleVisibilityOther}
                              onDelete={() => {
                                setEntries(prev => prev.filter(e => e.name !== entry.name));
                              }}
                            >
                              <div className="h-full w-full bg-emerald-50/30 rounded-2xl border-2 border-emerald-100 p-2 relative shadow-sm flex flex-col justify-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation(); 
                                    setEntries(prev => prev.filter(e => e.name !== entry.name));
                                  }}
                                  className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 text-emerald-400 hover:text-red-500 bg-white border border-emerald-100 rounded-full z-30 p-1 sm:p-1.5 shadow-sm transition-colors"
                                >
                                  <X size={12} className="sm:w-3.5 sm:h-3.5" strokeWidth={3}/>
                                </button>
                                
                                <span className="text-[10px] sm:text-xs font-bold text-emerald-600 mb-1 sm:mb-2 truncate block w-full px-1 uppercase tracking-tight">
                                  {entry.label}
                                </span>
                                <div className="cursor-default select-none pointer-events-none">
                                  <InputField
                                    label={`Total ${entry.unit ? `(${entry.unit})` : ''}`.trim()}
                                    type="text"
                                    value={dietInputs[entry.name] || '0'} 
                                    onChange={() => {}}
                                    disabled={false}
                                    icon={<div className="w-4" />} 
                                  />
                                </div>
                              </div>
                            </PrivacyWrapper>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Save Button Container */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-white shrink-0">
          <button
            onClick={handleSaveDiet}
            disabled={saving}
            className="w-full py-3 sm:py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm sm:text-base rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <CheckCircle size={20} />
            {saving ? 'SAVING...' : 'SAVE DIET LOG'}
          </button>
        </div>
      </div>
    </div>
  );
};