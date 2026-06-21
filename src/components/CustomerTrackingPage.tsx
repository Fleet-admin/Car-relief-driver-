import React, { useEffect, useRef, useState } from 'react';
import { Booking } from '../types';
import { SupabaseService } from '../lib/supabase';
import { Shield, Phone, MapPin, Loader2, Navigation, Compass, Map } from 'lucide-react';
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

  // Subscribe to real-time coordinate updates
  useEffect(() => {
    if (!booking) return;

    console.log('[CustomerTracking] Subscribing to Supabase Realtime updates for ID:', booking.id);
    const unsubscribe = SupabaseService.subscribeToBookingRealtime(booking.id, (updatedBooking) => {
      console.log('[CustomerTracking] Received realtime update:', updatedBooking);
      setBooking(updatedBooking);
    });

    return () => {
      unsubscribe();
    };
  }, [booking?.id]);

  // Handle Leaflet Map Initialization and updates whenever coordinates or status change
  useEffect(() => {
    if (!booking || !mapContainerRef.current) return;

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

      const isEnRoute = !booking.trip_status || booking.trip_status === 'driver_en_route';
      const isWorking = booking.trip_status === 'trip_in_progress';

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
    const isWorking = booking.trip_status === 'trip_in_progress';
    if (isWorking) {
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
    } else {
      // Driver is approaching pickup ('driver_en_route')
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

  return (
    <div id="customer-live-tracking-panel" className="max-w-md mx-auto my-4 pb-12 font-sans px-4">
      {/* Live Map Frame */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-xl overflow-hidden text-left flex flex-col">
        {/* Header Summary Info */}
        <div className="bg-neutral-900 text-white p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full bg-emerald-400 ${booking.status === 'Active' ? 'animate-pulse' : ''}`} />
              <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Trip Status</p>
            </div>
            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${
              booking.status === 'Active' ? 'bg-[#10B981]/20 text-[#10B981]' :
              booking.status === 'Completed' ? 'bg-indigo-500/20 text-indigo-400' :
              'bg-amber-500/20 text-amber-400'
            }`}>
              {booking.status === 'Confirmed' ? 'Scheduled' :
               booking.status === 'Active' ? 'En Route' :
               'Trip Completed'}
            </span>
          </div>
          <h2 className="text-base font-extrabold tracking-tight text-white mb-0.5">{statusMessageHeader}</h2>
          <p className="text-neutral-400 text-xs">
            Live Tracker: <strong className="text-indigo-300 font-bold">{
              booking.status === 'Confirmed' ? 'Waiting for driver to initiate trip...' :
              booking.status === 'Active' ? (booking.trip_status === 'trip_in_progress' ? 'Trip in progress' : 'Driver en route to pickup...') :
              'Trip completed successfully.'
            }</strong>
          </p>
        </div>

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
          <div className="flex items-center justify-between border-b border-neutral-150 pb-4">
            <div>
              <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Your Assigned Driver</p>
              <p className="text-sm font-bold text-neutral-900 mt-1">{booking.driver_name}</p>
              <p className="text-xs text-neutral-500 font-medium font-sans flex items-center gap-1 mt-0.5">
                Vehicle Plate: <span className="font-mono font-bold text-neutral-800">{booking.vehicle_number}</span>
              </p>
            </div>
            
            {booking.driver_phone && (
              <a
                href={`tel:${booking.driver_phone}`}
                className="p-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-full transition flex items-center justify-center active:scale-95 border border-neutral-200"
              >
                <Phone className="w-4 h-4 text-neutral-800" />
              </a>
            )}
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
