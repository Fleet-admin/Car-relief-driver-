/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Phone, 
  User, 
  FileText, 
  CheckCircle2, 
  ChevronRight, 
  Loader2, 
  RefreshCw, 
  Sliders, 
  Settings, 
  Coins, 
  Route, 
  Info,
  Car
} from 'lucide-react';
import { ServiceType, VehicleCategory } from '../types';
import { SupabaseService } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

interface InquiryFormProps {
  pickupLoc: LocationData | null;
  dropLoc: LocationData | null;
  selectedServiceType?: ServiceType;
  onSuccessSubmitted: (referenceId: string) => void;
  onClearLocations: () => void;
}

// Great-circle Haversine geodistance formula (distance in km)
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function InquiryForm({
  pickupLoc,
  dropLoc,
  selectedServiceType,
  onSuccessSubmitted,
  onClearLocations,
}: InquiryFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('Fleet Booking');

  useEffect(() => {
    if (selectedServiceType) {
      setServiceType(selectedServiceType);
    }
  }, [selectedServiceType]);
  const [vehicleCategory, setVehicleCategory] = useState<string>('');
  const [travelDate, setTravelDate] = useState('');
  const [additionalRequirements, setAdditionalRequirements] = useState('');

  // Auto-filled values from props
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropAddress, setDropAddress] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState<any | null>(null);
  const [submittedFare, setSubmittedFare] = useState<number>(0);

  // Configurable Vehicle Pricing Categories mapped via Admin Panel config
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>(() => {
    const defaultConfigs: VehicleCategory[] = [
      { id: 'hatchback', name: 'Hatchback', base_fare: 100.00, per_km_rate: 10.00, minimum_fare: 100.00, active: true },
      { id: 'sedan', name: 'Sedan', base_fare: 150.00, per_km_rate: 12.00, minimum_fare: 150.00, active: true },
      { id: 'premium-sedan', name: 'Premium Sedan', base_fare: 250.00, per_km_rate: 15.00, minimum_fare: 250.00, active: true },
      { id: 'suv', name: 'SUV', base_fare: 200.00, per_km_rate: 15.00, minimum_fare: 200.00, active: true },
      { id: 'premium-suv', name: 'Premium SUV', base_fare: 350.00, per_km_rate: 20.00, minimum_fare: 350.00, active: true },
      { id: 'innova-mpv', name: 'Innova / MPV Tier', base_fare: 250.00, per_km_rate: 16.00, minimum_fare: 250.00, active: true },
      { id: 'tempo-traveller', name: 'Tempo Traveller Cruiser', base_fare: 500.00, per_km_rate: 25.00, minimum_fare: 500.00, active: true },
    ];
    try {
      const saved = localStorage.getItem('admin_vehicle_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return defaultConfigs;
  });

  // Pull live values from Supabase on load
  useEffect(() => {
    let active = true;
    const loadCategories = async () => {
      try {
        const liveCats = await SupabaseService.getVehicleCategories();
        if (active && liveCats && liveCats.length > 0) {
          setVehicleCategories(liveCats);
        }
      } catch (err) {
        console.warn('Failed to load live vehicle categories from Supabase, staying with local fallback:', err);
      }
    };
    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  // Listen to live database rate change events
  useEffect(() => {
    const handleSettingsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<VehicleCategory[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setVehicleCategories(customEvent.detail);
      }
    };
    window.addEventListener('supabase-vehicle-categories-updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('supabase-vehicle-categories-updated', handleSettingsUpdate);
    };
  }, []);

  // Calculated distance states
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [calculationMethod, setCalculationMethod] = useState<'routing' | 'haversine' | null>(null);

  // Synchronize map picker values
  useEffect(() => {
    if (pickupLoc) {
      setPickupAddress(pickupLoc.address);
    }
  }, [pickupLoc]);

  useEffect(() => {
    if (dropLoc) {
      setDropAddress(dropLoc.address);
    }
  }, [dropLoc]);

  // Calculate distance between pickup and drop points
  useEffect(() => {
    if (!pickupLoc || !dropLoc) {
      setDistanceKm(null);
      setCalculationMethod(null);
      return;
    }

    const { lat: lat1, lng: lon1 } = pickupLoc;
    const { lat: lat2, lng: lon2 } = dropLoc;

    // Immediately calculate mathematically (Haversine) as instant fallback
    const fallbackDist = getHaversineDistance(lat1, lon1, lat2, lon2);
    setDistanceKm(fallbackDist);
    setCalculationMethod('haversine');
    setIsCalculatingDistance(true);

    // Fetch road driving calculation from OSRM OpenStreetMap routing API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    fetch(
      `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`,
      { signal: controller.signal }
    )
      .then((res) => {
        if (!res.ok) throw new Error('OSRM routing service failed');
        return res.json();
      })
      .then((data) => {
        if (data.routes && data.routes[0]) {
          const roadDistance = data.routes[0].distance / 1000; // convert to km
          setDistanceKm(roadDistance);
          setCalculationMethod('routing');
        }
      })
      .catch((err) => {
        console.warn('OSRM routing failed or timed out. Holding onto Great-Circle Haversine geodistance fallback.', err);
        // Fallback is already loaded, so we do nothing
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setIsCalculatingDistance(false);
      });

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [pickupLoc?.lat, pickupLoc?.lng, dropLoc?.lat, dropLoc?.lng]);

  const routeDistance = distanceKm !== null ? distanceKm : 0.0;

  // Pricing mapped from the active vehicle category settings
  const selectedCategoryConfig = useMemo(() => {
    return vehicleCategories.find(
      (cat) => cat.name.toLowerCase() === vehicleCategory.toLowerCase() && cat.active
    );
  }, [vehicleCategories, vehicleCategory]);

  // Easy & simple formula: Base Fare + (Distance in KM * Rate per KM) with minimum fare enforcement
  const estimatedFare = useMemo(() => {
    if (!selectedCategoryConfig) return 0.0;
    const calc = selectedCategoryConfig.base_fare + (routeDistance * selectedCategoryConfig.per_km_rate);
    return Math.max(calc, selectedCategoryConfig.minimum_fare || 0);
  }, [selectedCategoryConfig, routeDistance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Visual feedback validation
    if (!name.trim()) {
      setValidationError('Please enter your full name so our representatives can address you.');
      return;
    }
    if (!phone.trim()) {
      setValidationError('A working mobile/contact phone number is required to confirm details.');
      return;
    }
    if (!vehicleCategory) {
      setValidationError('Please select a preferred vehicle category.');
      return;
    }
    if (!travelDate) {
      setValidationError('Please select a scheduled travel or start date.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Encode estimation spec to prepend to additional requirements
      const baseFee = selectedCategoryConfig ? selectedCategoryConfig.base_fare : 0.0;
      const kmRate = selectedCategoryConfig ? selectedCategoryConfig.per_km_rate : 0.0;
      const specificationBadge = `[ESTIMATE DETAILS - Distance: ${routeDistance.toFixed(2)} km | Service: ${serviceType} | Vehicle: ${vehicleCategory} | Base: ₹${baseFee.toFixed(2)} | Rate: ₹${kmRate.toFixed(2)}/km | Estimated Fare: ₹${estimatedFare.toFixed(2)}]`;
      
      const combinedNotes = additionalRequirements.trim()
        ? `${specificationBadge}\nCustomer Notes: ${additionalRequirements.trim()}`
        : specificationBadge;

      const dbResponse = await SupabaseService.insertInquiry({
        name: name.trim(),
        phone: phone.trim(),
        service_type: serviceType,
        pickup_location: pickupAddress || null,
        pickup_latitude: pickupLoc ? pickupLoc.lat : null,
        pickup_longitude: pickupLoc ? pickupLoc.lng : null,
        drop_location: dropAddress || null,
        drop_latitude: dropLoc ? dropLoc.lat : null,
        drop_longitude: dropLoc ? dropLoc.lng : null,
        travel_date: travelDate,
        additional_requirements: combinedNotes,
        vehicle_category: vehicleCategory,
      });

      // Dispatch real status
      setSubmittedFare(estimatedFare);
      setSubmissionSuccess(dbResponse);
      onSuccessSubmitted(dbResponse.id);

      // Clean form inputs
      setName('');
      setPhone('');
      setServiceType('Fleet Booking');
      setVehicleCategory('');
      setTravelDate('');
      setAdditionalRequirements('');
      setPickupAddress('');
      setDropAddress('');
      onClearLocations();
    } catch (err: any) {
      setValidationError(err?.message || 'A network error occurred while submitting. Please check your database settings or try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-neutral-200 shadow-md rounded-2xl overflow-hidden lg:h-full flex flex-col">
      <div className="bg-neutral-900 px-6 py-4 flex items-center justify-between shrink-0">
        <h3 className="text-white font-semibold text-sm tracking-wide uppercase">Request a Service Quote</h3>
        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500 text-neutral-950 font-mono tracking-wider animate-pulse">
          Instant Dispatch
        </span>
      </div>

      <div className="p-6 flex-grow flex flex-col">
        <AnimatePresence mode="wait">
          {submissionSuccess ? (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="text-center py-6 flex flex-col items-center justify-center"
              id="form-submission-success-panel"
            >
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-bold text-neutral-900 tracking-tight">Inquiry Submitted Successfully</h4>
              <p className="text-xs text-neutral-500 mt-2 max-w-sm">
                Your request has been filed directly. A support manager will contact you manually via the provided phone number.
              </p>

              {/* Real reference UUID container */}
              <div className="mt-5 p-4 bg-neutral-50 border border-neutral-200 rounded-xl w-full text-left font-sans">
                <div className="flex justify-between items-center pb-2 border-b border-neutral-150 mb-2">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Reference ID / UUID</span>
                  <span className="text-[10px] px-2 py-0.5 font-bold uppercase rounded bg-neutral-200 text-neutral-700 font-mono">
                    Sync Live
                  </span>
                </div>
                <code className="text-xs font-mono font-bold text-neutral-800 break-all block text-center select-all bg-white p-2 border border-neutral-100 rounded">
                  {submissionSuccess.id}
                </code>

                <div className="mt-4 pt-2 border-t border-neutral-200 grid grid-cols-2 gap-2 text-[11px] text-neutral-600">
                  <div>
                    <span className="block font-medium text-neutral-400">CUSTOMER</span>
                    <span className="font-bold">{submissionSuccess.name}</span>
                  </div>
                  <div>
                    <span className="block font-medium text-neutral-400">SERVICE</span>
                    <span className="font-bold text-black">{submissionSuccess.service_type}</span>
                  </div>
                </div>

                <div className="mt-3 p-2 bg-neutral-900 text-amber-400 rounded-lg text-center font-mono text-[11px] font-bold">
                  Estimated Reference Fare: ₹{submittedFare.toFixed(2)}
                </div>
              </div>

              <button
                type="button"
                id="btn-submit-another-quote"
                onClick={() => setSubmissionSuccess(null)}
                className="mt-6 flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Submit Another Request
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 flex-grow flex flex-col justify-between">
              {/* Validation Warning block */}
              {validationError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
                  {validationError}
                </div>
              )}

              {/* Name field */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-neutral-400" />
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="input-customer-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alexander Mercer"
                  required
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all font-sans"
                />
              </div>

              {/* Phone field */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-neutral-400" />
                  Contact Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="input-customer-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +1 (555) 019-2834"
                  required
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all font-sans"
                />
              </div>

              {/* Service Type drop down */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-neutral-400" />
                  Select Required Service <span className="text-red-500">*</span>
                </label>
                <select
                  id="select-service-type"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as ServiceType)}
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition"
                >
                  <option value="Fleet Booking">Car Booking Services (Fleet Booking)</option>
                  <option value="Driver Relief Services">Driver Relief Services</option>
                  <option value="Outstation Trip">Outstation Trips</option>
                  <option value="Wedding Plan">Wedding Plan / Event Bookings</option>
                  <option value="Premium Logistics Temporary">Premium Logistics Temporary</option>
                  <option value="Custom Requirement">Custom Requirements</option>
                </select>
              </div>

              {/* Vehicle Category drop down */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-neutral-400" />
                  Vehicle Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="select-vehicle-category"
                  value={vehicleCategory}
                  onChange={(e) => setVehicleCategory(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition"
                >
                  <option value="">Choose your preferred vehicle category</option>
                  {vehicleCategories.filter(cat => cat.active).map(cat => (
                    <option key={cat.id || cat.name} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>

                {/* Optional description display note */}
                {vehicleCategory && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-neutral-800 transition-all">
                    <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      {(() => {
                        if (vehicleCategory === 'Premium Sedan') {
                          return (
                            <>
                              <div className="font-bold text-neutral-950">Premium Sedan</div>
                              <div className="text-neutral-600">1–4 passengers — standard executive sedan option.</div>
                              <div className="text-neutral-900 font-bold mt-1">Recommended Capacity: 1–4 Passengers</div>
                            </>
                          );
                        }
                        if (vehicleCategory === 'Luxury SUV') {
                          return (
                            <>
                              <div className="font-bold text-neutral-950">Luxury SUV</div>
                              <div className="text-neutral-600">1–6 passengers — premium SUV option.</div>
                              <div className="text-neutral-900 font-bold mt-1">Recommended Capacity: 1–6 Passengers</div>
                            </>
                          );
                        }
                        if (vehicleCategory === 'Innova / MPV Tier') {
                          return (
                            <>
                              <div className="font-bold text-neutral-950">Innova / MPV Tier</div>
                              <div className="text-neutral-600">1–7 passengers — family and group transport option.</div>
                              <div className="text-neutral-900 font-bold mt-1">Recommended Capacity: 1–7 Passengers</div>
                            </>
                          );
                        }
                        if (vehicleCategory === 'Tempo Traveller Cruiser') {
                          return (
                            <>
                              <div className="font-bold text-neutral-950">Tempo Traveller Cruiser</div>
                              <div className="text-neutral-600">8–20 passengers — large group transport option.</div>
                              <div className="text-neutral-900 font-bold mt-1">Recommended Capacity: 8–20 Passengers</div>
                            </>
                          );
                        }

                        // For dynamic newly added ones or other categories
                        const nameLower = vehicleCategory.toLowerCase();
                        let desc = "Comfortable transport option.";
                        let capacity = "1–4 Passengers";
                        if (nameLower.includes('hatchback')) {
                          desc = "Comfortable compact hatchback option.";
                          capacity = "1–4 Passengers";
                        } else if (nameLower.includes('sedan')) {
                          desc = "Standard comfort sedan option.";
                          capacity = "1–4 Passengers";
                        } else if (nameLower.includes('suv')) {
                          desc = "Spacious utility vehicle option.";
                          capacity = "1–6 Passengers";
                        } else if (nameLower.includes('mpv') || nameLower.includes('innova')) {
                          desc = "Premium group MPV option.";
                          capacity = "1–7 Passengers";
                        } else if (nameLower.includes('tempo') || nameLower.includes('traveller')) {
                          desc = "Large luxury group traveler options.";
                          capacity = "8–20 Passengers";
                        }

                        return (
                          <>
                            <div className="font-bold text-neutral-950">{vehicleCategory}</div>
                            <div className="text-neutral-600">{desc}</div>
                            <div className="text-neutral-900 font-bold mt-1">Recommended Capacity: {capacity}</div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Map Synced Pickup location preview/edit */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Pickup Location</span>
                  {pickupAddress && (
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                      Coordinates Set
                    </span>
                  )}
                </label>
                <textarea
                  id="input-pickup-location"
                  rows={3}
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Select pickup point by clicking on the interactive map..."
                  className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition font-sans leading-relaxed"
                />
              </div>

              {/* Map Synced Drop/Destination location preview/edit */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Destination / Drop Location</span>
                  {dropAddress && (
                    <span className="text-[10px] text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                      Coordinates Set
                    </span>
                  )}
                </label>
                <textarea
                  id="input-drop-location"
                  rows={3}
                  value={dropAddress}
                  onChange={(e) => setDropAddress(e.target.value)}
                  placeholder="Select destination point by clicking on the interactive map or leave blank if unspecified..."
                  className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition font-sans leading-relaxed"
                />
              </div>

              {/* DYNAMIC INSTANT ESTIMATE BLOCK */}
              <div id="dynamic-fare-estimation-block" className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-neutral-400" />
                    Fare Calculation Reference
                  </span>

                  {pickupLoc && dropLoc && (
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                      <Route className="w-3 h-3 text-neutral-400" />
                      Distance Synced
                    </span>
                  )}
                </div>

                {/* Instant estimation breakdown receipt card */}
                <div className="p-4 bg-neutral-950 text-white rounded-xl space-y-3 border border-neutral-800 shadow-md relative overflow-hidden font-sans">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />

                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" />
                      Fare Estimation Reference
                    </span>
                    <span className="text-[9px] uppercase font-bold text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 flex items-center gap-1 font-mono">
                      <span className={`w-1.5 h-1.5 rounded-full ${isCalculatingDistance ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                      {isCalculatingDistance ? 'Calculating...' : calculationMethod === 'routing' ? 'OSRM Road Map Route' : calculationMethod === 'haversine' ? 'Fallback Geodistance' : 'Awaiting Map Pins'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-neutral-400">
                      <span>Base Fare Fee:</span>
                      <span className="font-mono text-neutral-200">₹{(selectedCategoryConfig?.base_fare || 0.0).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-neutral-400">
                      <span>Calculated distance:</span>
                      <span className="font-mono font-bold text-neutral-200">
                        {distanceKm !== null ? `${distanceKm.toFixed(2)} km` : '0.00 km (Needs dropout location)'}
                      </span>
                    </div>

                    {distanceKm !== null && (
                      <div className="flex justify-between items-center text-neutral-400">
                        <span>Distance cost ({distanceKm.toFixed(1)} km × ₹{(selectedCategoryConfig?.per_km_rate || 0.0).toFixed(2)}/km):</span>
                        <span className="font-mono text-neutral-200">₹{(distanceKm * (selectedCategoryConfig?.per_km_rate || 0.0)).toFixed(2)}</span>
                      </div>
                    )}

                    {selectedCategoryConfig && selectedCategoryConfig.minimum_fare && estimatedFare === selectedCategoryConfig.minimum_fare && (
                      <div className="flex justify-between items-center text-amber-400 text-[10px]">
                        <span>Minimum Fare Enforced:</span>
                        <span className="font-mono">₹{selectedCategoryConfig.minimum_fare.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-neutral-800 flex justify-between items-baseline">
                      <span className="text-xs font-bold text-neutral-300">Total Reference Quote:</span>
                      <div className="text-right">
                        <span className="text-lg font-extrabold text-amber-400 font-mono">
                          ₹{estimatedFare.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 bg-neutral-900 rounded-lg text-[9px] text-neutral-400 leading-normal border border-neutral-800 flex gap-1.5 items-start">
                    <Info className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                    <span>
                      The calculated fare is for general customer reference only and does not process payments. Final pricing is subject to admin verification and manual booking confirmation.
                    </span>
                  </div>
                </div>
              </div>

              {/* Travel date selection */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                  Scheduled Travel / Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="input-travel-date"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition font-sans"
                />
              </div>

              {/* Special instructions */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  What are your additional requirements?
                </label>
                <textarea
                  id="input-additional-requirements"
                  rows={3}
                  value={additionalRequirements}
                  onChange={(e) => setAdditionalRequirements(e.target.value)}
                  placeholder="e.g. Need child-safety seat, return trip needed, premium vehicle class only..."
                  className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition font-sans"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                id="btn-submit-inquiry-form"
                disabled={isSubmitting}
                className="w-full py-3 px-4 mt-6 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold tracking-wide uppercase transition duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Submitting Quote...
                  </>
                ) : (
                  <>
                    Review & Request Plan
                    <ChevronRight className="w-4 h-4 text-neutral-300" />
                  </>
                )}
              </button>
            </form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
