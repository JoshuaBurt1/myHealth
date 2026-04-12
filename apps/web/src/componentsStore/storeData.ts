// storeData.ts

// In the future, if there is a marketplace function, other users images need to be stored a different way
// import local image assets
import multivitamin from '../assets/storeItems/multivitamin.jpg';
import wheyProtein from '../assets/storeItems/wheyProtein.jpg';

import bloodGlucoseMonitor from '../assets/storeItems/bloodGlucoseMonitor.jpg';
import pulseOximeter from '../assets/storeItems/pulseOximeter.jpg';
import automatedBPCuff from '../assets/storeItems/automatedBPCuff.jpg';
import digitalStethoscope from '../assets/storeItems/digitalStethoscope.jpg';
import portableUltrasound from '../assets/storeItems/portableUltrasound.jpg';
import mouthThermometer from '../assets/storeItems/mouthThermometer.jpg';

import iodine from '../assets/storeItems/iodine.jpg';
import packingGauze from '../assets/storeItems/packingGauze.jpg';
import gauzePads from '../assets/storeItems/gauzePads.jpg';
import firstAidKit from '../assets/storeItems/firstAidKit.jpg';
import klingWrap from '../assets/storeItems/klingWrap.jpg';
import pressureWrap from '../assets/storeItems/pressureWrap.jpg';

import aerochamber from '../assets/storeItems/aerochamber.jpg';
import catheterBag from '../assets/storeItems/catheterBag.jpg';
import ostomySupplies from '../assets/storeItems/ostomySupplies.jpg';

import n95Img from '../assets/storeItems/n95Mask.jpg';
import nitrileImg from '../assets/storeItems/nitrileGloves.jpg';
import isolationGown from '../assets/storeItems/isolationGown.jpg';
import faceShield from '../assets/storeItems/faceShield.jpg';
import surgicalMask from '../assets/storeItems/surgicalMask.jpg';

import pillCutter from '../assets/storeItems/pillCutter.jpg';
import pillOrganizer from '../assets/storeItems/pillOrganizer.jpg';

import radonDetector from '../assets/storeItems/radonDetector.jpg';
import dosimeter from '../assets/storeItems/dosimeter.jpg';
import waterFilter from '../assets/storeItems/waterFilter.jpg';
import tdsMeter from '../assets/storeItems/tdsMeter.jpg';
import indoorAirQualityMonitor from '../assets/storeItems/indoorAirQualityMonitor.jpg';
import xrfSpectrometer from '../assets/storeItems/xrfSpectrometer.jpg';

import robotHCWorker from '../assets/storeItems/robotHCWorker.jpg';

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  category: 'Supplements' | 'Diagnostic Equipment' | 'Medical Supplies' | 'Specialized Care' | 'Healthcare Safety' | 'Healthcare Tools' | 'Environmental Safety' | 'Personnel';
  price: string;
  image?: string;
}

export const storeItems: StoreItem[] = [
  // Supplements
  { id: 's1', name: 'Multivitamin', category: 'Supplements', price: '$24.99', description: 'Daily essential nutrients to support overall health and immune function.', image: multivitamin },
  { id: 's2', name: 'Protein Powder', category: 'Supplements', price: '$45.00', description: 'High-quality protein source for muscle recovery and nutritional supplementation.', image: wheyProtein },
  
  // Diagnostic Equipment
  { id: 'd1', name: 'Blood Glucose Tester', category: 'Diagnostic Equipment', price: '$29.99', description: 'Digital meter for monitoring blood sugar levels in real-time.', image: bloodGlucoseMonitor },
  { id: 'd2', name: 'Pulse Oximeter', category: 'Diagnostic Equipment', price: '$19.00', description: 'Non-invasive device to measure oxygen saturation and heart rate.', image: pulseOximeter },
  { id: 'd3', name: 'Automatic Blood Pressure Cuff', category: 'Diagnostic Equipment', price: '$49.99', description: 'Upper-arm monitor for quick and accurate blood pressure readings.', image: automatedBPCuff },
  { id: 'd4', name: 'Digital Stethoscope', category: 'Diagnostic Equipment', price: '$299.00', description: 'Amplified heart and lung sounds with visual waveform display and recording capabilities.', image: digitalStethoscope },
  { id: 'd5', name: 'Handheld Ultrasound', category: 'Diagnostic Equipment', price: '$1,850.00', description: 'Portable imaging probe that connects to mobile devices for real-time internal visualization.', image: portableUltrasound },
  { id: 'd6', name: 'Mouth Thermometer', category: 'Diagnostic Equipment', price: '$12.50', description: 'Fast-acting digital thermometer for accurate body temperature monitoring.', image: mouthThermometer},
  
  // Medical Supplies
  { id: 'm1', name: 'First Aid Kit', category: 'Medical Supplies', price: '$35.00', description: 'Comprehensive emergency response kit for minor injuries and wound care.', image: firstAidKit },
  { id: 'm2', name: 'Gauze Pads', category: 'Medical Supplies', price: '$8.50', description: 'Sterile absorbent pads for cleaning and protecting wounds.', image: gauzePads },
  { id: 'm3', name: 'Packing Gauze', category: 'Medical Supplies', price: '$12.00', description: 'Long-strip cotton gauze designed for packing deep wounds and managing drainage.', image: packingGauze },
  { id: 'm4', name: 'Iodine Antiseptic Solution', category: 'Medical Supplies', price: '$11.00', description: 'Povidone-iodine solution for topical skin preparation and infection prevention in minor cuts.', image: iodine },
  { id: 'm5', name: 'Kling Wrap', category: 'Medical Supplies', price: '$5.00', description: 'Conforming stretch bandage used to hold primary dressings in place.', image: klingWrap },
  { id: 'm6', name: 'Pressure Wrap', category: 'Medical Supplies', price: '$12.00', description: 'Elastic compression bandage to reduce swelling and support joints.', image: pressureWrap },

  // Specialized Care
  { id: 'sc1', name: 'Aero Chamber', category: 'Specialized Care', price: '$30.00', description: 'Valved holding chamber to improve effective delivery of inhaler medication.', image: aerochamber },
  { id: 'sc2', name: 'Catheter Bag', category: 'Specialized Care', price: '$18.00', description: 'Standard drainage bag with secure anti-reflux valves for hygiene.', image: catheterBag },
  { id: 'sc3', name: 'Universal Ostomy Kit', category: 'Specialized Care', price: '$45.00', description: 'Compact pouching system including skin barrier and adhesive for pediatric or low-profile use.', image: ostomySupplies },
 
  // Healthcare Safety
  { id: 'h1', name: 'Masks (N95/KN95)', category: 'Healthcare Safety', price: '$15.00', description: 'High-filtration respirators to protect against airborne particles.', image: n95Img },
  { id: 'h2', name: 'Surgical Masks', category: 'Healthcare Safety', price: '$8.00', description: 'Standard 3-ply disposable masks for general fluid resistance and breathability.', image: surgicalMask },
  { id: 'h3', name: 'Gloves (Nitrile)', category: 'Healthcare Safety', price: '$12.00', description: 'Powder-free, latex-free gloves for sterile handling and protection.', image: nitrileImg },
  { id: 'h4', name: 'Face Shield', category: 'Healthcare Safety', price: '$7.00', description: 'Transparent barrier to protect the face from splashes and debris.', image: faceShield },
  { id: 'h5', name: 'Yellow Isolation Gown', category: 'Healthcare Safety', price: '$22.00', description: 'Fluid-resistant protective apparel with elastic cuffs for full-body coverage.', image: isolationGown },
  
  // Healthcare Tools
  { id: 't1', name: 'Smart Pill Dispenser', category: 'Healthcare Tools', price: '$120.00', description: 'Medication organizer with AM and PM labels.', image: pillOrganizer },
  { id: 't2', name: 'Pill Cutter', category: 'Healthcare Tools', price: '$120.00', description: 'Pill cutter tool to administer fractional dosages.', image: pillCutter },

  // Environmental Safety
  { id: 'e1', name: 'TDS Meter', category: 'Environmental Safety', price: '$14.00', description: 'Tester for Total Dissolved Solids to check drinking water purity.', image: tdsMeter },
  { id: 'e2', name: 'Water Filter System', category: 'Environmental Safety', price: '$150.00', description: 'Multi-stage filtration system to remove contaminants from tap water.', image: waterFilter },
  { id: 'e3', name: 'Indoor Air Quality Monitor', category: 'Environmental Safety', price: '$95.00', description: 'Sensors for CO2, VOCs, and particulate matter levels in your home.', image: indoorAirQualityMonitor },
  { id: 'e4', name: 'Radon Detector', category: 'Environmental Safety', price: '$130.00', description: 'Continuous monitoring device for detecting dangerous radon gas levels.', image: radonDetector },
  { id: 'e5', name: 'Dosiemeter', category: 'Environmental Safety', price: '$100.00', description: 'Professional-grade instrument for measuring ionizing radiation.', image: dosimeter },
  { id: 'e6', name: 'XRF Spectrometer', category: 'Environmental Safety', price: '$10,000.00', description: 'Advanced tool for analyzing light spectra and material composition.', image: xrfSpectrometer  },
  
  // Personnel
  { id: 'p1', name: 'Robot Healthcare Worker', category: 'Personnel', price: '$12,500.00', description: 'Autonomous AI assistant for patient monitoring and basic care tasks.', image: robotHCWorker },
];