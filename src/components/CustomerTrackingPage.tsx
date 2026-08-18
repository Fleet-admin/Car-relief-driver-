import React, { useEffect, useRef, useState } from 'react';
import { Booking } from '../types';
import { SupabaseService } from '../lib/supabase';
import { Shield, Phone, MapPin, Loader2, Navigation, Compass, Map, Check, Car } from 'lucide-react';
import { motion } from 'motion/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface CustomerTrackingPageProps {
  trackingToken: string;
}

export default function CustomerTrackingPage({ trackingToken }: CustomerTrackingPageProps) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<any | null>(null);
  const [category, setCategory] = useState<any | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const routeToPickupRef = useRef<L.Polyline | null>(null);
  const routeToDestRef = useRef<L.Polyline | null>(null);

  // Load booking page initially
  useEffect(() => {
    async function fetchBookingDetails() {
      try {
        console.log('[CustomerTracking] Fetching booking details for token:', trackingToken);
        const data = await SupabaseService.getBookingByTrackingToken(trackingToken);
        if (!data) {
          setError('Tracking link is invalid or of an expired booking session.');
        } else {
          setBooking(data);
        }
      } catch (err) {
        console.error('Error fetching tracking booking details:', err);
        setError('Could not connect to live fleet data feed.');
      } finally {
        setLoading(false);
      }
    }

    fetchBookingDetails();
  }, [trackingToken]);

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
        console.warn('Error fetching extra vehicle/category details for customer tracking:', err);
      }
    }
    fetchVehicleDetails();
  }, [booking?.vehicle_id, booking?.vehicle_number]);

  const imageUrl = vehicle?.photo || category?.image_url || '';
  useEffect(() => {
    if (imageUrl) {
      setImageLoading(true);
      setImageError(false);
    } else {
      setImageLoading(false);
      setImageError(true);
    }
  }, [imageUrl]);

  // Subscribe to real-time coordinate updates
  useEffect(() => {
    if (!booking) return;
    if (booking.status === 'Completed') {
      console.log('[CustomerTracking] Booking completed. Skipping/unsubscribing real-time updates.');
      return;
    }

    console.log('[CustomerTracking] Subscribing to Supabase Realtime updates for ID:', booking.id);
    const unsubscribe = SupabaseService.subscribeToBookingRealtime(booking.id, (updatedBooking) => {
      console.log('[CustomerTracking] Received realtime update:', updatedBooking);
      setBooking(updatedBooking);
    });

    return () => {
      console.log('[CustomerTracking] Cleaning up real-time updates subscription.');
      unsubscribe();
    };
  }, [booking?.id, booking?.status]);

  // Handle map container unmount / layout cleanup
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        console.log('[Leaflet Map] Removing map instance on component unmount');
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle Leaflet Map Initialization and updates whenever coordinates or status change
  useEffect(() => {
    if (!booking || !mapContainerRef.current) return;
    if (booking.status === 'Completed') {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      return;
    }

    // Define custom marker icons using pure HTML/CSS to completely bypass typical bundler image issues
    const driverIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-10 h-10 bg-indigo-500 rounded-full opacity-40 animate-ping"></div>
          <div class="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white border-2 border-white shadow-xl text-base">
            🚗
          </div>
        </div>
      `,
      className: 'custom-leaflet-driver',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const pickupIcon = L.divIcon({
      html: `
        <div class="flex flex-col items-center">
          <div class="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-[11px] border-2 border-white shadow-lg">
            📍
          </div>
          <div class="w-1.5 h-1.5 bg-emerald-500 transform rotate-45 -mt-1 shadow-sm"></div>
        </div>
      `,
      className: 'custom-leaflet-pickup',
      iconSize: [28, 32],
      iconAnchor: [14, 32],
    });

    const destinationIcon = L.divIcon({
      html: `
        <div class="flex flex-col items-center">
          <div class="w-7 h-7 bg-rose-500 rounded-full flex items-center justify-center text-white font-bold text-[11px] border-2 border-white shadow-lg font-mono">
            🏁
          </div>
          <div class="w-1.5 h-1.5 bg-rose-500 transform rotate-45 -mt-1 shadow-sm"></div>
        </div>
      `,
      className: 'custom-leaflet-drop',
      iconSize: [28, 32],
      iconAnchor: [14, 32],
    });

    // Approximate Coordinates from context fallback if explicit GPS records aren't set yet
    // Default fallback to general region
    const pickupLat = booking.pickup_latitude || 12.9716;
    const pickupLng = booking.pickup_longitude || 77.5946;
    const destLat = booking.drop_latitude || booking.drop_latitude || 12.9300;
    const destLng = booking.drop_longitude || booking.drop_longitude || 77.6200;

    const currentDriverLat = booking.last_latitude || pickupLat;
    const currentDriverLng = booking.last_longitude || pickupLng;

    // 1. Create Map if it doesn't exist
    if (!mapRef.current) {
      console.log('[Leaflet Map] Initializing map instance on DOM...');
      
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([currentDriverLat, currentDriverLng], 14);

      // Standard OSM Tile Layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      // Add pickup marker
      pickupMarkerRef.current = L.marker([pickupLat, pickupLng], { icon: pickupIcon })
        .bindPopup('<b>Pickup Point A</b><br>' + booking.pickup_location)
        .addTo(map);

      // Add destination marker
      destinationMarkerRef.current = L.marker([destLat, destLng], { icon: destinationIcon })
        .bindPopup('<b>Destination Point B</b><br>' + booking.destination_location)
        .addTo(map);

      // Add Live Driver Marker
      driverMarkerRef.current = L.marker([currentDriverLat, currentDriverLng], { icon: driverIcon })
        .bindPopup('<b>Driver</b><br>Live Location Tracking')
        .addTo(map);

      // Fit map elements bounds beautifully
      try {
        const bounds = L.latLngBounds([
          [pickupLat, pickupLng],
          [destLat, destLng],
          [currentDriverLat, currentDriverLng]
        ]);
        map.fitBounds(bounds, { padding: [50, 50] });
      } catch (e) {
        console.warn('Map bounds fit error:', e);
      }
    } else {
      // 2. Map already constructed. Update live marker with coordinates
      console.log('[Leaflet Map] Live coordinates refresh:', currentDriverLat, currentDriverLng);
      
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([currentDriverLat, currentDriverLng]);
        
        // Pan dynamically to driver's location if trip is active
        if (booking.status === 'Active') {
          mapRef.current.panTo([currentDriverLat, currentDriverLng]);
        }
      }
    }

    // 3. Render Route Polylines: Clear existing, draw fresh lines
    const mapInstance = mapRef.current;
    if (mapInstance && booking.status === 'Active') {
      if (routeToPickupRef.current) {
        routeToPickupRef.current.remove();
        routeToPickupRef.current = null;
      }
      if (routeToDestRef.current) {
        routeToDestRef.current.remove();
        routeToDestRef.current = null;
      }

      const isEnRoute = !booking.trip_status || booking.trip_status === 'en_route_pickup' || booking.trip_status === 'arrived_pickup';
      const isWorking = booking.trip_status === 'trip_started';

      if (isEnRoute) {
        // Approach: Driver (🚗) → Pickup (📍) with dashed indigo line
        if (booking.last_latitude && booking.last_longitude && pickupLat && pickupLng) {
          routeToPickupRef.current = L.polyline(
            [[booking.last_latitude, booking.last_longitude], [pickupLat, pickupLng]],
            { color: '#6366f1', weight: 4, dashArray: '8, 8', opacity: 0.85 }
          ).addTo(mapInstance);
        }
        // General: Pickup (📍) → Destination (🏁) with dashed gray line
        if (pickupLat && pickupLng && destLat && destLng) {
          routeToDestRef.current = L.polyline(
            [[pickupLat, pickupLng], [destLat, destLng]],
            { color: '#9ca3af', weight: 3, dashArray: '5, 5', opacity: 0.6 }
          ).addTo(mapInstance);
        }
      } else if (isWorking) {
        // En route: Active trip, show solid emerald path: Driver (🚗) → Destination (🏁)
        if (booking.last_latitude && booking.last_longitude && destLat && destLng) {
          routeToDestRef.current = L.polyline(
            [[booking.last_latitude, booking.last_longitude], [destLat, destLng]],
            { color: '#10b981', weight: 5, opacity: 0.9 }
          ).addTo(mapInstance);
        }
      }
    }

  }, [booking]);

  // Adjust Leaflet map sizing on container resize
  useEffect(() => {
    if (!mapRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        console.log('[Leaflet Map] Invalidate map size due to layout resize.');
        mapRef.current.invalidateSize();
      }
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [booking]);

  useEffect(() => {
    return () => {
      if (routeToPickupRef.current) routeToPickupRef.current.remove();
      if (routeToDestRef.current) routeToDestRef.current.remove();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center">
        <Loader2 className="w-10 h-10 text-neutral-900 animate-spin mb-4" />
        <p className="text-neutral-500 text-sm font-medium font-sans">Connecting to Live Geospatial Feed...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-8 p-6 bg-rose-50 rounded-2xl border border-rose-200 text-center">
        <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="font-bold text-rose-600 text-lg">⚠️</Shield>
        </div>
        <h3 className="text-sm font-bold text-rose-800 uppercase tracking-widest mb-1">Access Failure</h3>
        <p className="text-xs text-rose-600 font-medium font-sans mb-4 leading-relaxed">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition"
        >
          Retry Load
        </button>
      </div>
    );
  }

  if (!booking) return null;

  // Haversine formula calculation for real-time driver proximity indicators
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

  const calculateETA = (distanceInMeters: number) => {
    // Average city traffic speed ~30 km/h (approx 8.33 m/s)
    const averageSpeedMPS = 8.33; 
    const seconds = distanceInMeters / averageSpeedMPS;
    const minutes = Math.ceil(seconds / 60);
    if (minutes <= 1) return "Arriving now";
    return `${minutes} min`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const pickupLat = booking.pickup_latitude;
  const pickupLng = booking.pickup_longitude;
  const dropLat = booking.drop_latitude;
  const dropLng = booking.drop_longitude;
  const driverLat = booking.last_latitude;
  const driverLng = booking.last_longitude;

  // Compute key distances for reactive UI information
  const distanceToPickup = (booking.status === 'Active' && driverLat && driverLng && pickupLat && pickupLng)
    ? getDistanceInMeters(driverLat, driverLng, pickupLat, pickupLng)
    : null;

  const distanceToDestination = (booking.status === 'Active' && driverLat && driverLng && dropLat && dropLng)
    ? getDistanceInMeters(driverLat, driverLng, dropLat, dropLng)
    : null;

  // Determine state representations based strictly on requested spec
  let statusMessageHeader = "Driver is on the way";
  let etaValue = "Calculating...";
  let distanceValue = "Calculating...";
  let proximityMessage: string | null = null;
  let proximityColor = 'bg-stone-50 text-stone-700 border-stone-200';

  if (booking.status === 'Confirmed') {
    statusMessageHeader = "Driver is on the way"; // scheduled before starts tracking
    etaValue = "Waiting for trip...";
    distanceValue = "Waiting...";
  } else if (booking.status === 'Completed') {
    statusMessageHeader = "Trip completed";
    etaValue = "Arrived";
    distanceValue = "Arrived";
  } else if (booking.status === 'Active') {
    if (booking.trip_status === 'trip_started') {
      statusMessageHeader = "Trip in progress";
      if (distanceToDestination !== null) {
        distanceValue = formatDistance(distanceToDestination);
        etaValue = calculateETA(distanceToDestination);
        
        if (distanceToDestination <= 120) {
          proximityMessage = "Vehicle has arrived at your destination! (within 100m)";
          proximityColor = "bg-emerald-50 text-emerald-800 border-emerald-250 animate-pulse";
        } else if (distanceToDestination <= 550) {
          proximityMessage = "Vehicle is extremely close to your destination! (within 500m)";
          proximityColor = "bg-emerald-50 text-emerald-800 border-emerald-200";
        } else if (distanceToDestination <= 1500) {
          proximityMessage = "Vehicle is approaching your destination (within 1.5km)";
          proximityColor = "bg-indigo-50 text-indigo-800 border-indigo-200";
        }
      }
    } else if (booking.trip_status === 'arrived_pickup') {
      statusMessageHeader = "Driver has arrived at your location";
      proximityMessage = "Driver has arrived at your location!";
      proximityColor = "bg-emerald-100 text-emerald-950 border-emerald-300 animate-pulse font-semibold";
      if (distanceToPickup !== null) {
        distanceValue = formatDistance(distanceToPickup);
      } else {
        distanceValue = "0 m";
      }
      etaValue = "Arrived";
    } else {
      // Driver is approaching pickup ('en_route_pickup' or fallback)
      statusMessageHeader = "Driver is on the way";
      if (distanceToPickup !== null) {
        distanceValue = formatDistance(distanceToPickup);
        etaValue = calculateETA(distanceToPickup);
        
        if (distanceToPickup <= 100) {
          statusMessageHeader = "Driver has almost arrived";
          proximityMessage = "Driver has almost arrived";
          proximityColor = "bg-emerald-50 text-emerald-800 border-emerald-250 animate-pulse";
        } else if (distanceToPickup <= 500) {
          statusMessageHeader = "Arriving soon";
          proximityMessage = "Your driver is arriving soon";
          proximityColor = "bg-emerald-50 text-emerald-800 border-emerald-200";
        } else {
          statusMessageHeader = "Driver is on the way";
          if (distanceToPickup <= 1500) {
            proximityMessage = "Driver is approaching your pickup location (within 1.5km)";
            proximityColor = "bg-indigo-50 text-indigo-800 border-indigo-200";
          }
        }
      }
    }
  }

  const isCompleted = booking.status === 'Completed';

  if (isCompleted) {
    const bookingId = booking.id;
    const pickupLocation = booking.pickup_location;
    const dropLocation = booking.destination_location;
    const completedTime = booking.completed_at 
      ? new Date(booking.completed_at).toLocaleString() 
      : new Date().toLocaleString();

    return (
      <div id="customer-trip-completed-panel" className="max-w-md mx-auto my-6 px-4 font-sans text-left">
        <div className="bg-white rounded-3xl border border-neutral-200 shadow-xl overflow-hidden p-6 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-3xl">
            ✅
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight">Trip Completed</h1>
            <p className="text-sm text-neutral-600 leading-relaxed font-semibold">
              Thank you for choosing Remix Car & Driver Relief Services.
            </p>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Your journey has been successfully completed.
            </p>
          </div>

          <div className="border-t border-b border-neutral-100 py-4 space-y-4 text-left text-xs text-neutral-700">
            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">Booking ID:</span>
              <p className="font-mono text-neutral-800 break-all font-semibold">{bookingId}</p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">Pickup:</span>
              <p className="font-semibold text-neutral-800">{pickupLocation}</p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">Destination:</span>
              <p className="font-semibold text-neutral-800">{dropLocation}</p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">Completed At:</span>
              <p className="font-semibold text-neutral-800">{completedTime}</p>
            </div>
          </div>

          <div className="text-[11px] text-neutral-400 font-medium">
            Remix Car & Driver Relief Services • Secure Trip Session Closed
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="customer-live-tracking-panel" className="max-w-md mx-auto my-4 pb-12 font-sans px-4">
      {/* Live Map Frame */}
      <div className={`rounded-3xl border border-neutral-200 shadow-xl overflow-hidden text-left flex flex-col transition-all duration-300 ${
        isCompleted ? 'bg-neutral-50/90 border-neutral-300 ring-4 ring-neutral-950/5' : 'bg-white'
      }`}>
        {/* Header Summary Info */}
        <div className={`text-white p-5 transition-colors duration-300 ${isCompleted ? 'bg-neutral-800' : 'bg-neutral-900'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full bg-emerald-400 ${booking.status === 'Active' ? 'animate-pulse' : ''}`} />
              <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Trip Status</p>
            </div>
            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${
              booking.status === 'Active' ? 'bg-[#10B981]/20 text-[#10B981]' :
              booking.status === 'Completed' ? 'bg-neutral-600 text-neutral-200' :
              'bg-amber-500/20 text-amber-400'
            }`}>
              {booking.status === 'Confirmed' ? 'Scheduled' :
               booking.status === 'Active' ? (
                 booking.trip_status === 'arrived_pickup' ? 'Arrived' : 
                 booking.trip_status === 'trip_started' ? 'In Progress' : 'En Route'
               ) :
               'Trip Completed'}
            </span>
          </div>
          <h2 className="text-base font-extrabold tracking-tight text-white mb-0.5">{statusMessageHeader}</h2>
          <p className="text-neutral-400 text-xs">
            Live Tracker: <strong className="text-indigo-300 font-bold">{
              booking.status === 'Confirmed' ? 'Waiting for driver to initiate trip...' :
              booking.status === 'Active' ? (
                booking.trip_status === 'trip_started' ? 'Trip in progress' :
                booking.trip_status === 'arrived_pickup' ? 'Driver has arrived at pickup.' :
                'Driver en route to pickup...'
              ) :
              'Trip completed successfully.'
            }</strong>
          </p>
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

        {/* The Map Section */}
        <div className="relative">
          <div 
            ref={mapContainerRef} 
            id="tracking-leaflet-map" 
            className="w-full h-72 bg-neutral-100 border-b border-neutral-200"
            style={{ zIndex: 1 }}
          />
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-neutral-200 text-[10px] font-bold text-neutral-800 shadow-md flex items-center gap-1.5" style={{ zIndex: 10 }}>
            <Compass className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
            <span>Realtime Map Active</span>
          </div>
        </div>

        {/* Dynamic Proximity Alerts */}
        {proximityMessage && (
          <div className={`mx-5 mt-4 p-3 rounded-2xl border text-xs font-bold flex items-center gap-2.5 ${proximityColor}`}>
            <span className="w-2.5 h-2.5 rounded-full bg-current shrink-0 animate-ping" />
            <span>{proximityMessage}</span>
          </div>
        )}

        {/* Information Grid Cards: Distance & ETA */}
        <div className="grid grid-cols-2 gap-3.5 px-5 pt-4">
          <div id="info-card-distance" className="bg-neutral-50 border border-neutral-150 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Driver Distance</span>
            <span className="text-base font-extrabold text-neutral-900 mt-1">{distanceValue}</span>
          </div>
          <div id="info-card-eta" className="bg-neutral-50 border border-neutral-150 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Estimated ETA</span>
            <span className="text-base font-extrabold text-indigo-600 mt-1">{etaValue}</span>
          </div>
        </div>

        {/* Assigned Personnel Details */}
        <div className="p-5 space-y-4">
          <div className="bg-white border border-neutral-150 rounded-2xl overflow-hidden shadow-sm">
            {/* Fixed Vehicle Image Container */}
            <div className="relative w-full aspect-[16/9] bg-neutral-100 overflow-hidden flex items-center justify-center">
              {/* Image Loading State */}
              {imageLoading && (
                <div className="absolute inset-0 bg-neutral-100 flex items-center justify-center animate-pulse">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
                    <span className="text-[10px] text-neutral-400 font-semibold font-sans">Loading vehicle photo...</span>
                  </div>
                </div>
              )}

              {/* Vehicle Image */}
              {imageUrl && !imageError ? (
                <img
                  src={imageUrl}
                  alt={vehicle?.vehicle_model || category?.name || "Vehicle"}
                  referrerPolicy="no-referrer"
                  className={`w-full h-full object-cover object-center transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                  onLoad={() => setImageLoading(false)}
                  onError={() => {
                    setImageError(true);
                    setImageLoading(false);
                  }}
                />
              ) : (
                /* Premium Fallback Placeholder based on vehicle category */
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 to-neutral-100 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-neutral-200/60 mb-2 text-neutral-400">
                    <Car className="w-7 h-7 text-indigo-500" />
                  </div>
                  <span className="text-xs font-bold text-neutral-700 font-sans">
                    {category?.name || 'Assigned Vehicle'}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-semibold mt-0.5">
                    {booking.vehicle_number || 'Plate Pending'}
                  </span>
                </div>
              )}
            </div>

            {/* Vehicle Details & Action Layout */}
            <div className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/50">
                    {category?.name || 'Standard Service'}
                  </span>
                  <h4 className="text-base font-extrabold text-neutral-900 tracking-tight leading-tight pt-0.5">
                    {vehicle?.vehicle_model || category?.name || 'Assigned Vehicle'}
                  </h4>
                  <p className="text-xs text-neutral-500 font-semibold flex items-center gap-1.5 font-sans">
                    Plate Number: <span className="font-mono font-bold text-neutral-800 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">{booking.vehicle_number}</span>
                  </p>
                </div>
              </div>

              {/* Driver and Call button section */}
              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                <div className="space-y-0.5 min-w-[120px] flex-1">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">Assigned Driver</span>
                  <p className="text-sm font-bold text-neutral-800 leading-tight truncate">{booking.driver_name}</p>
                  {!isCompleted && booking.driver_phone && (
                    <p className="text-xs text-neutral-500 font-semibold font-mono mt-0.5">
                      {booking.driver_phone}
                    </p>
                  )}
                </div>

                {!isCompleted && booking.driver_phone && (
                  <a
                    href={`tel:${booking.driver_phone}`}
                    id="btn-call-driver-tracking"
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white rounded-xl text-xs font-bold font-sans transition flex items-center justify-center gap-2 shadow-sm border border-neutral-900 shrink-0 min-w-[110px]"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Driver</span>
                  </a>
                )}
              </div>
            </div>
          </div>
          {/* Location Listings Info Cards */}
          <div className="space-y-3 bg-neutral-50 p-4 rounded-2xl border border-neutral-150">
            {/* Pickup Location */}
            <div id="info-card-pickup" className="flex gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0 flex items-center justify-center border-2 border-white ring-2 ring-emerald-500/20" />
              <div>
                <span className="text-[9px] uppercase font-bold text-emerald-600 block leading-none mb-1">Pickup Location 📍</span>
                <span className="text-xs text-neutral-800 font-bold leading-normal">{booking.pickup_location}</span>
              </div>
            </div>

            {/* Destination Location */}
            <div id="info-card-destination" className="flex gap-2.5 pt-1 border-t border-neutral-200/50">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 shrink-0 flex items-center justify-center border-2 border-white ring-2 ring-rose-500/20" />
              <div>
                <span className="text-[9px] uppercase font-bold text-rose-600 block leading-none mb-1">Destination 🏁</span>
                <span className="text-xs text-neutral-800 font-bold leading-normal">{booking.destination_location}</span>
              </div>
            </div>
          </div>

          {/* Footer trip completion panel status */}
          {booking.status === 'Completed' && (
            <div className="bg-indigo-50 border border-indigo-150 rounded-2xl p-4 text-center">
              <span className="text-indigo-800 font-bold text-xs flex items-center justify-center gap-1">
                ✓ Trip Successfully Completed
              </span>
              {booking.completed_at && (
                <p className="text-[10px] text-indigo-500 font-sans mt-0.5">Completed at {new Date(booking.completed_at).toLocaleTimeString()}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
