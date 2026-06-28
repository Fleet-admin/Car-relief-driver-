import React, { useState, useEffect, useRef } from 'react';
import { Booking } from '../types';
import { SupabaseService } from '../lib/supabase';
import { Play, MapPin, CheckCircle, Navigation, Phone, ExternalLink, Loader2, Shield, Check } from 'lucide-react';
import { motion } from 'motion/react';

// Import Leaflet CSS in case we render anything, but in Leaflet CSS standard is used in tracking
interface DriverPageProps {
  driverToken: string;
}

export default function DriverPage({ driverToken }: DriverPageProps) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [vehicle, setVehicle] = useState<any | null>(null);
  const [category, setCategory] = useState<any | null>(null);
  
  const geoWatchId = useRef<number | null>(null);
  const updateIntervalId = useRef<any | null>(null);
  const latestCoords = useRef<{ latitude: number; longitude: number; speed?: number | null; heading?: number | null } | null>(null);
  const bookingRef = useRef<Booking | null>(null);

  // Load associated vehicle and category details
  useEffect(() => {
    if (!booking) return;
    async function fetchVehicleDetails() {
      try {
        if (booking.vehicle_id || booking.vehicle_number) {
          const vehiclesList = await SupabaseService.getVehicles();
          const foundVehicle = vehiclesList.find(v => v.id === booking.vehicle_id || v.vehicle_number === booking.vehicle_number);
          if (foundVehicle) {
            setVehicle(foundVehicle);
            const categoriesList = await SupabaseService.getVehicleCategories();
            const foundCategory = categoriesList.find(c => c.id === foundVehicle.category_id || c.name === foundVehicle.category_id);
            if (foundCategory) {
              setCategory(foundCategory);
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching extra vehicle/category details for driver view:', err);
      }
    }
    fetchVehicleDetails();
  }, [booking?.vehicle_id, booking?.vehicle_number]);

  // Sync ref with state
  useEffect(() => {
    bookingRef.current = booking;
  }, [booking]);

  // Haversine formula calculation for auto-transition check
  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // returns distance in meters
  };

  useEffect(() => {
    async function loadBooking() {
      try {
        console.log('[DriverPage] Querying booking for token:', driverToken);
        const data = await SupabaseService.getBookingByDriverToken(driverToken);
        if (!data) {
          setError('Invalid Driver link or booking expired.');
        } else {
          setBooking(data);
          bookingRef.current = data;
          if (data.status === 'Active') {
            setTrackingActive(true);
            startGPSWatch(data.id, data);
          }
        }
      } catch (err) {
        console.error('Error fetching driver booking', err);
        setError('Failed to fetch booking details.');
      } finally {
        setLoading(false);
      }
    }

    loadBooking();

    // Cleanup geolocation trackers on unmount
    return () => {
      stopGPSWatch();
    };
  }, [driverToken]);

  const startGPSWatch = (bookingId: string, currentBooking: Booking) => {
    if (!navigator.geolocation) {
      alert('Local GPS Geolocation is not supported by this browser/device.');
      return;
    }

    console.log('[GPS Tracking] Initializing live tracking for booking:', bookingId);
    
    // Request permission and watch position
    geoWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed, heading } = position.coords;
        setCurrentCoords({ latitude, longitude });
        latestCoords.current = { latitude, longitude, speed, heading };
        console.log('[GPS Tracking] Location sampled:', latitude, longitude, 'speed:', speed, 'heading:', heading);
      },
      (geoError) => {
        console.error('[GPS Tracking] Geolocation watch error:', geoError);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    // Set up interval to write coordinates to Supabase every 6 seconds
    updateIntervalId.current = setInterval(async () => {
      const liveBooking = bookingRef.current || currentBooking;
      if (latestCoords.current && liveBooking) {
        const { latitude, longitude, speed, heading } = latestCoords.current;
        console.log('[GPS Tracking] Uploading coordinates to database:', latitude, longitude);
        
        let targetTripStatus: 'en_route_pickup' | 'arrived_pickup' | 'trip_started' | 'trip_completed' = 'en_route_pickup';
        
        // If currentBooking or latest local booking state is trip_started or arrived_pickup, keep it.
        // Otherwise, run check to see if we reached pickup point.
        if (liveBooking.trip_status === 'trip_started') {
          targetTripStatus = 'trip_started';
        } else if (liveBooking.trip_status === 'arrived_pickup') {
          targetTripStatus = 'arrived_pickup';
        } else if (liveBooking.trip_status === 'trip_completed') {
          targetTripStatus = 'trip_completed';
        } else {
          const pLat = liveBooking.pickup_latitude;
          const pLng = liveBooking.pickup_longitude;
          if (pLat && pLng) {
            const distanceToPickup = getDistanceInMeters(latitude, longitude, pLat, pLng);
            if (distanceToPickup <= 10) {
              console.log('[GPS GPS Threshold] Auto-sensing: Vehicle inside 10m of pickup point. Setting trip_status to arrived_pickup.');
              targetTripStatus = 'arrived_pickup';
              liveBooking.trip_status = 'arrived_pickup';
              setBooking(prev => prev ? { ...prev, trip_status: 'arrived_pickup' } : null);
            }
          }
        }

        await SupabaseService.updateBookingCoords(bookingId, latitude, longitude, {
          speed: speed || undefined,
          heading: heading || undefined,
          trip_status: targetTripStatus
        });
      }
    }, 6000);
  };

  const stopGPSWatch = () => {
    if (geoWatchId.current !== null) {
      navigator.geolocation.clearWatch(geoWatchId.current);
      geoWatchId.current = null;
    }
    if (updateIntervalId.current !== null) {
      clearInterval(updateIntervalId.current);
      updateIntervalId.current = null;
    }
    console.log('[GPS Tracking] Live tracking components cleared.');
  };

  const handleStartTrip = async () => {
    if (!booking) return;

    // Check Geolocation Support and Request initial permission immediately
    if (!navigator.geolocation) {
      alert('Local GPS Geolocation is not supported by this browser/device.');
      return;
    }

    setLoading(true);
    try {
      // First, get initial coordinate to ensure permission is approved
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, speed, heading } = position.coords;
          latestCoords.current = { latitude, longitude, speed, heading };
          setCurrentCoords({ latitude, longitude });

          // Start trip in DB (sets status: Active and trip_status: en_route_pickup)
          const success = await SupabaseService.startBookingTrip(booking.id);
          if (success) {
            // Determine initial status: if already near pickup (<10m), set 'arrived_pickup', else 'en_route_pickup'
            let initialTripStatus: 'en_route_pickup' | 'arrived_pickup' = 'en_route_pickup';
            if (booking.pickup_latitude && booking.pickup_longitude) {
              const distanceToPickup = getDistanceInMeters(latitude, longitude, booking.pickup_latitude, booking.pickup_longitude);
              if (distanceToPickup <= 10) {
                initialTripStatus = 'arrived_pickup';
              }
            }

            // Upload initial coordinates immediately with trip status
            await SupabaseService.updateBookingCoords(booking.id, latitude, longitude, {
              speed: speed || undefined,
              heading: heading || undefined,
              trip_status: initialTripStatus
            });
            
            // Re-fetch booking or set state
            const updatedBooking: Booking = { 
              ...booking, 
              status: 'Active', 
              trip_status: initialTripStatus,
              started_at: new Date().toISOString(), 
              last_latitude: latitude, 
              last_longitude: longitude 
            };
            
            setBooking(updatedBooking);
            bookingRef.current = updatedBooking;
            setTrackingActive(true);
            
            // Start periodic updates
            startGPSWatch(booking.id, updatedBooking);

            // Auto-open Google Maps turn-by-turn navigation directly to Pickup Location
            const pickupPart = (updatedBooking.pickup_latitude && updatedBooking.pickup_longitude)
              ? `${updatedBooking.pickup_latitude},${updatedBooking.pickup_longitude}`
              : encodeURIComponent(updatedBooking.pickup_location);

            const travelRouteUrl = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${pickupPart}&travelmode=driving&dir_action=navigate`;
            console.log('[GPS Start Session] Auto-opening turn-by-turn navigation to pickup location:', travelRouteUrl);
            window.open(travelRouteUrl, '_system');
          } else {
            setError('Failed to update trip start in database.');
          }
          setLoading(false);
        },
        (geoError) => {
          setLoading(false);
          console.error('[GPS Auth] Geolocation permission denied or failed:', geoError);
          alert('GPS/location permission is required to start this trip so the client can track vehicle live on map.');
        },
        { enableHighAccuracy: true }
      );
    } catch (err) {
      console.error('Error starting trip', err);
      setError('An error occurred while starting the trip.');
      setLoading(false);
    }
  };

  const handleOpenNavigation = () => {
    if (!booking) return;

    const dLat = currentCoords?.latitude || latestCoords.current?.latitude || booking.last_latitude;
    const dLng = currentCoords?.longitude || latestCoords.current?.longitude || booking.last_longitude;

    // Decide what the next destination is: final destination if arrived at pickup or trip started, otherwise direct pickup spot.
    const isHeadingToDestination = booking.trip_status === 'arrived_pickup' || booking.trip_status === 'trip_started';
    
    let destPart = '';
    if (isHeadingToDestination) {
      destPart = (booking.drop_latitude && booking.drop_longitude)
        ? `${booking.drop_latitude},${booking.drop_longitude}`
        : encodeURIComponent(booking.destination_location);
    } else {
      destPart = (booking.pickup_latitude && booking.pickup_longitude)
        ? `${booking.pickup_latitude},${booking.pickup_longitude}`
        : encodeURIComponent(booking.pickup_location);
    }

    let mapsUrl = '';
    if (dLat && dLng) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${dLat},${dLng}&destination=${destPart}&travelmode=driving&dir_action=navigate`;
    } else {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destPart}&travelmode=driving&dir_action=navigate`;
    }

    console.log('[Navigation] Launching Google Maps Turn-by-Turn Navigation to:', isHeadingToDestination ? 'drop' : 'pickup', mapsUrl);
    window.open(mapsUrl, '_system');
  };

  const handleArrivedAtPickup = async () => {
    if (!booking) return;

    setLoading(true);
    try {
      const lat = currentCoords?.latitude || latestCoords.current?.latitude || booking.last_latitude || booking.pickup_latitude || 0;
      const lng = currentCoords?.longitude || latestCoords.current?.longitude || booking.last_longitude || booking.pickup_longitude || 0;

      const success = await SupabaseService.updateBookingCoords(booking.id, lat, lng, {
        trip_status: 'arrived_pickup'
      });

      if (success) {
        const updatedBooking: Booking = { 
          ...booking, 
          trip_status: 'arrived_pickup' 
        };
        setBooking(updatedBooking);
        bookingRef.current = updatedBooking;
      } else {
        setError('Failed to update arrival status in database.');
      }
    } catch (err) {
      console.error('Error setting arrived at pickup:', err);
      setError('An error occurred while setting arrival status.');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToDestination = async () => {
    if (!booking) return;

    setLoading(true);
    try {
      const lat = currentCoords?.latitude || latestCoords.current?.latitude || booking.last_latitude || booking.pickup_latitude || 0;
      const lng = currentCoords?.longitude || latestCoords.current?.longitude || booking.last_longitude || booking.pickup_longitude || 0;

      // Update Database and trigger Trip Started phase
      const success = await SupabaseService.updateBookingCoords(booking.id, lat, lng, {
        trip_status: 'trip_started'
      });

      if (success) {
        const updatedBooking: Booking = { 
          ...booking, 
          trip_status: 'trip_started' 
        };
        setBooking(updatedBooking);
        bookingRef.current = updatedBooking;

        // Automatically launch turn-by-turn navigation to Destination Drop-off Location
        const destPart = (booking.drop_latitude && booking.drop_longitude)
          ? `${booking.drop_latitude},${booking.drop_longitude}`
          : encodeURIComponent(booking.destination_location);

        let mapsUrl = '';
        if (lat && lng) {
          mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${destPart}&travelmode=driving&dir_action=navigate`;
        } else {
          mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destPart}&travelmode=driving&dir_action=navigate`;
        }

        console.log('[Navigation] Launching Google Maps Turn-by-Turn Navigation to destination:', mapsUrl);
        window.open(mapsUrl, '_system');
      } else {
        setError('Failed to update trip progress in database.');
      }
    } catch (err) {
      console.error('Error in handleNavigateToDestination:', err);
      setError('An error occurred while setting trip started or opening maps.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTrip = async () => {
    if (!booking) return;

    setLoading(true);
    try {
      const success = await SupabaseService.completeBookingTrip(booking.id);
      if (success) {
        stopGPSWatch();
        setTrackingActive(false);
        setBooking(prev => prev ? { ...prev, status: 'Completed', trip_status: 'trip_completed', completed_at: new Date().toISOString() } : null);
      } else {
        setError('Failed to update trip completion in database.');
      }
    } catch (err) {
      console.error('Error completing trip', err);
      setError('An error occurred while completing the trip.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !booking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center">
        <Loader2 className="w-10 h-10 text-neutral-900 animate-spin mb-4" />
        <p className="text-neutral-500 text-sm font-medium font-sans">Connecting to Fleet Tracking Engine...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-8 p-6 bg-red-50 rounded-2xl border border-red-200 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-sm font-bold text-red-800 uppercase tracking-wide mb-1">Access Error</h3>
        <p className="text-xs text-red-600 font-medium font-sans leading-relaxed mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
        >
          Retry Load
        </button>
      </div>
    );
  }

  if (!booking) return null;

  const isCompleted = booking.status === 'Completed';
  const isWorking = booking.trip_status === 'trip_started' || booking.trip_status === 'arrived_pickup';

  return (
    <div id="driver-workspace-container" className="max-w-md mx-auto my-4 pb-12 font-sans px-4">
      {/* Driver Workspace Card */}
      <div className={`rounded-3xl border border-neutral-200 shadow-xl overflow-hidden text-left flex flex-col transition-all duration-300 ${
        isCompleted ? 'bg-neutral-50/90 border-neutral-300 ring-4 ring-neutral-950/5' : 'bg-white'
      }`}>
        {/* Header Indicator */}
        <div className={`p-6 relative text-white transition-colors duration-300 ${isCompleted ? 'bg-neutral-800' : 'bg-neutral-900'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#10B981] bg-[#10B981]/15 px-2.5 py-1 rounded">
              Trip Workspace
            </span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
              booking.status === 'Confirmed' ? 'bg-indigo-500/10 text-indigo-400' :
              booking.status === 'Active' ? 'bg-[#10B981]/10 text-emerald-400 animate-pulse' :
              'bg-neutral-600 text-neutral-300'
            }`}>
              {booking.status === 'Confirmed' ? '● Assigned' :
               booking.status === 'Active' ? '● Active' :
               '● Completed'}
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-1">Trip Assignment</h2>
          <p className="text-neutral-400 text-xs">Vehicle Assigned: <strong className="text-white text-sm ml-1 font-mono">{booking.vehicle_number}</strong></p>
        </div>

        {/* completed banner state */}
        {isCompleted && (
          <div className="bg-[#10B981] text-white px-5 py-4 flex items-center gap-3 animate-fade-in border-b border-emerald-600">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-white stroke-[3px]" />
            </div>
            <div>
              <p className="text-xs font-extrabold tracking-wider uppercase text-white leading-tight">TRIP COMPLETED</p>
              <p className="text-[11px] font-medium text-emerald-100 mt-0.5">This trip has been completed successfully.</p>
            </div>
          </div>
        )}

        {/* Client details info */}
        <div className="p-6 space-y-5">
          {/* Customer specifications container */}
          <div className="border-b border-neutral-150 pb-5 space-y-4">
            <div>
              <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Client Details</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-neutral-900 text-base">{booking.customer_name}</p>
                  {!isCompleted && booking.customer_phone && (
                    <p className="text-xs text-neutral-500 font-medium font-sans flex items-center gap-1 mt-1" id="customer-phone-text-container">
                      Phone: <span className="font-mono font-bold text-neutral-800">{booking.customer_phone}</span>
                    </p>
                  )}
                </div>
                {!isCompleted && booking.customer_phone && (
                  <a
                    href={`tel:${booking.customer_phone}`}
                    id="btn-call-customer-driverview"
                    className="p-3 bg-neutral-100 text-neutral-900 hover:bg-neutral-200 rounded-full transition flex items-center justify-center active:scale-95"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div>
                  <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Driver Assignment</h3>
                  <p className="text-sm font-bold text-neutral-800">{booking.driver_name || 'Assigned Driver'}</p>
                  {!isCompleted && booking.driver_phone && (
                    <p className="text-xs text-neutral-500 font-medium font-sans flex items-center gap-1 mt-0.5" id="driver-phone-text-container">
                      Phone: <span className="font-mono font-bold text-neutral-800">{booking.driver_phone}</span>
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-neutral-100">
                  <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Vehicle Details</h3>
                  {category && (
                    <p className="text-xs text-neutral-800 font-bold mt-1">
                      Category: <span className="text-indigo-600">{category.name}</span>
                    </p>
                  )}
                  <p className="text-xs text-neutral-500 font-medium font-sans flex flex-wrap items-center gap-2 mt-0.5">
                    Plate: <span className="font-mono font-bold text-neutral-800">{booking.vehicle_number}</span>
                    {vehicle?.vehicle_model && (
                      <>
                        <span className="text-neutral-300">|</span>
                        <span>Model: <span className="font-semibold text-neutral-700">{vehicle.vehicle_model}</span></span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {(vehicle?.photo || category?.image_url) && (
                <div className="w-20 h-14 bg-neutral-50 border border-neutral-200 rounded-xl overflow-hidden p-1 flex items-center justify-center shrink-0 self-center">
                  <img 
                    src={vehicle?.photo || category?.image_url} 
                    alt="Vehicle preview" 
                    referrerPolicy="no-referrer"
                    className="max-w-full max-h-full object-contain rounded"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Route directions itinerary */}
          <div className="space-y-4 border-b border-neutral-100 pb-5">
            <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Route Itinerary</h3>
            
            {/* Pickup Location */}
            <div className={`flex gap-3 p-3 rounded-2xl border transition-all duration-300 ${
              !isWorking && booking.status !== 'Completed'
                ? 'bg-emerald-50/50 border-emerald-200 ring-2 ring-emerald-500/5' 
                : 'bg-neutral-50/50 border-neutral-150'
            }`}>
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold ${
                  !isWorking && booking.status !== 'Completed'
                    ? 'bg-[#10B981] text-white' 
                    : 'bg-neutral-200 text-neutral-600'
                }`}>
                  {!isWorking && booking.status !== 'Completed' ? '🚩' : '✓'}
                </div>
                <div className="w-0.5 h-10 bg-dashed border-l-2 border-neutral-200 my-1 flex-grow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    !isWorking && booking.status !== 'Completed' ? 'text-emerald-700' : 'text-neutral-400'
                  }`}>Pickup Location (Point A)</p>
                  {!isWorking && booking.status !== 'Completed' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-emerald-100 text-emerald-800 animate-pulse">
                      Active Target
                    </span>
                  )}
                  {(isWorking || booking.status === 'Completed') && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-neutral-200 text-neutral-700">
                      Arrived
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-neutral-800 leading-relaxed font-sans mt-0.5">{booking.pickup_location}</p>
              </div>
            </div>

            {/* Destination */}
            <div className={`flex gap-3 p-3 rounded-2xl border transition-all duration-300 ${
              isWorking 
                ? 'bg-indigo-50/50 border-indigo-200 ring-2 ring-indigo-500/5' 
                : 'bg-neutral-50/50 border-neutral-150'
            }`}>
              <div className="w-6 h-6 bg-red-50 border border-red-200 rounded-full flex items-center justify-center text-red-600 font-bold text-xs shrink-0">
                🏁
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    isWorking ? 'text-indigo-700' : 'text-neutral-400'
                  }`}>Destination / Drop Location (Point B)</p>
                  {isWorking && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-indigo-100 text-indigo-800 animate-pulse">
                      Active Target
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-neutral-800 leading-relaxed font-sans mt-0.5">{booking.destination_location}</p>
              </div>
            </div>
          </div>

          {/* Schedulers or Timings */}
          <div className="flex items-center justify-between text-neutral-600 bg-neutral-50 px-4 py-3 rounded-2xl text-xs border border-neutral-150">
            <div>
              <span className="text-neutral-400 font-bold uppercase text-[9px] block">Travel Date</span>
              <span className="font-semibold text-neutral-800">{booking.booking_date}</span>
            </div>
            <div className="text-right">
              <span className="text-neutral-400 font-bold uppercase text-[9px] block">Start Time</span>
              <span className="font-semibold text-neutral-800 font-mono">{booking.booking_time}</span>
            </div>
          </div>

          {/* ACTIVE GPS TELEMETRY BLOCK FOR LIVE ASSURANCE */}
          {trackingActive && currentCoords && (
            <div className="bg-emerald-50 border border-[#10B981]/20 p-4 rounded-2xl text-left">
              <p className="text-[9px] uppercase font-bold text-[#10B981] tracking-widest flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                Live GPS Active
              </p>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-emerald-800 font-mono">
                <p>Latitude: <strong className="text-neutral-900">{currentCoords.latitude.toFixed(6)}</strong></p>
                <p>Longitude: <strong className="text-neutral-900">{currentCoords.longitude.toFixed(6)}</strong></p>
              </div>
              <p className="text-[10px] text-emerald-600 mt-1 font-medium font-sans">Updating live location updates on map every 5-10 seconds.</p>
            </div>
          )}

          {/* Workflow actions dashboard */}
          <div className="pt-2 space-y-3">
            {booking.status === 'Confirmed' && (
              <button
                onClick={handleStartTrip}
                disabled={loading}
                className="w-full py-4 bg-[#10B981] hover:bg-emerald-600 text-white rounded-2xl text-sm font-bold tracking-wide uppercase transition duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Start Trip
                  </>
                )}
              </button>
            )}

            {booking.status === 'Active' && (
              <div className="space-y-3">
                {/* 1. If en_route_pickup status: show Open Navigation + Arrived at Pickup */}
                {booking.trip_status === 'en_route_pickup' && (
                  <>
                    <button
                      onClick={handleOpenNavigation}
                      className="w-full py-4 bg-[#111827] hover:bg-[#1F2937] text-white rounded-2xl text-sm font-bold tracking-wide uppercase transition duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98]"
                    >
                      <Navigation className="w-4 h-4 fill-white animate-bounce" />
                      Open Google Maps Navigation
                    </button>

                    <button
                      onClick={handleArrivedAtPickup}
                      disabled={loading}
                      className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-sm font-bold tracking-wide uppercase transition duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <MapPin className="w-4 h-4 text-white" />
                          Arrived at Pickup
                        </>
                      )}
                    </button>
                  </>
                )}

                {/* 2. If arrived_pickup status: show Navigate to Destination (one click to maps and trip_started!) */}
                {booking.trip_status === 'arrived_pickup' && (
                  <button
                    onClick={handleNavigateToDestination}
                    disabled={loading}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold tracking-wide uppercase transition duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Navigation className="w-4 h-4 fill-white animate-pulse" />
                        Navigate to Destination
                      </>
                    )}
                  </button>
                )}

                {/* 3. If trip_started status: show Re-open Navigation + Complete Trip */}
                {booking.trip_status === 'trip_started' && (
                  <>
                    <button
                      onClick={handleOpenNavigation}
                      className="w-full py-3 bg-[#111827]/80 hover:bg-[#111827] text-white rounded-2xl text-xs font-bold tracking-wide uppercase transition duration-200 flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
                    >
                      <Navigation className="w-3.5 h-3.5 fill-white" />
                      Re-open Destination Navigation
                    </button>

                    <button
                      onClick={handleCompleteTrip}
                      disabled={loading}
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-sm font-bold tracking-wide uppercase transition duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 text-white" />
                          Complete Trip
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            )}

            {booking.status === 'Completed' && (
              <div className="text-center p-6 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2 text-indigo-600 font-bold text-sm">
                  ✓
                </div>
                <h4 className="text-sm font-bold text-indigo-950 uppercase tracking-wider mb-0.5">Trip Completed</h4>
                <p className="text-xs text-indigo-700 font-sans leading-relaxed">This passenger run was safely completed. Thank you!</p>
                <div className="text-left text-[10px] text-indigo-500 font-mono mt-3 pt-3 border-t border-indigo-100/50 space-y-1">
                  <p>Started: {new Date(booking.started_at || '').toLocaleTimeString()}</p>
                  <p>Finished: {new Date(booking.completed_at || '').toLocaleTimeString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
