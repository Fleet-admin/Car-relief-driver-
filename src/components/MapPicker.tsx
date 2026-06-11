/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Search, MapPin, Navigation, Loader2 } from 'lucide-react';

// Leaflet styles loading helper (injects leaflet css on-demand to prevent import issues)
const injectLeafletStyles = () => {
  if (document.getElementById('leaflet-css-bundle')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css-bundle';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
};

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

interface MapPickerProps {
  onSelectPickup: (loc: LocationData) => void;
  onSelectDrop: (loc: LocationData) => void;
  pickupLoc: LocationData | null;
  dropLoc: LocationData | null;
}

export default function MapPicker({
  onSelectPickup,
  onSelectDrop,
  pickupLoc,
  dropLoc,
}: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const dropMarkerRef = useRef<L.Marker | null>(null);

  const [activePinType, setActivePinType] = useState<'pickup' | 'drop'>('pickup');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // SVG-based Leaflet custom markers
  const createMarkerIcon = (color: string, label: 'P' | 'D') => {
    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center" style="width: 36px; height: 36px;">
          <!-- Ripple Effect -->
          <span class="absolute inline-flex h-full w-full rounded-full bg-${color === '#10B981' ? 'emerald' : 'red'}-400 opacity-30 animate-ping"></span>
          <!-- Main Icon -->
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="34" height="34" stroke="white" stroke-width="1.5" class="drop-shadow-md">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          </svg>
          <!-- Center Letter -->
          <span class="absolute text-[11px] font-bold text-white mb-2">${label}</span>
        </div>
      `,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 34],
    });
  };

  useEffect(() => {
    injectLeafletStyles();

    // Default target: New Delhi or standard fallback
    const startLat = 28.6139;
    const startLng = 77.2090;

    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [startLat, startLng],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      mapRef.current = map;

      // Click event for pinning
      map.on('click', async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        reverseGeocode(lat, lng);
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync state markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Pickup Marker
    if (pickupLoc) {
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = L.marker([pickupLoc.lat, pickupLoc.lng], {
          icon: createMarkerIcon('#10B981', 'P'),
          draggable: true,
        })
          .addTo(map)
          .on('dragend', (e) => {
            const marker = e.target;
            const position = marker.getLatLng();
            reverseGeocodeSpecific(position.lat, position.lng, 'pickup');
          });
      } else {
        pickupMarkerRef.current.setLatLng([pickupLoc.lat, pickupLoc.lng]);
      }
    } else {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.remove();
        pickupMarkerRef.current = null;
      }
    }

    // Drop Marker
    if (dropLoc) {
      if (!dropMarkerRef.current) {
        dropMarkerRef.current = L.marker([dropLoc.lat, dropLoc.lng], {
          icon: createMarkerIcon('#EF4444', 'D'),
          draggable: true,
        })
          .addTo(map)
          .on('dragend', (e) => {
            const marker = e.target;
            const position = marker.getLatLng();
            reverseGeocodeSpecific(position.lat, position.lng, 'drop');
          });
      } else {
        dropMarkerRef.current.setLatLng([dropLoc.lat, dropLoc.lng]);
      }
    } else {
      if (dropMarkerRef.current) {
        dropMarkerRef.current.remove();
        dropMarkerRef.current = null;
      }
    }
  }, [pickupLoc, dropLoc]);

  // Adjust bounds if both markers exist
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pickupLoc && dropLoc) {
      const group = new L.FeatureGroup([
        L.marker([pickupLoc.lat, pickupLoc.lng]),
        L.marker([dropLoc.lat, dropLoc.lng]),
      ]);
      map.fitBounds(group.getBounds().pad(0.1));
    } else if (pickupLoc) {
      map.setView([pickupLoc.lat, pickupLoc.lng], 15);
    } else if (dropLoc) {
      map.setView([dropLoc.lat, dropLoc.lng], 15);
    }
  }, [pickupLoc?.lat, pickupLoc?.lng, dropLoc?.lat, dropLoc?.lng]);

  const reverseGeocode = async (lat: number, lng: number) => {
    reverseGeocodeSpecific(lat, lng, activePinType);
  };

  const reverseGeocodeSpecific = async (lat: number, lng: number, type: 'pickup' | 'drop') => {
    setErrorMessage(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
      );
      if (!res.ok) throw new Error('Failed to resolve address details');
      const data = await res.json();
      const address = data.display_name || `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      if (type === 'pickup') {
        onSelectPickup({ address, lat, lng });
        // Automatically switch type to drop so selection flow is frictionless
        setActivePinType('drop');
      } else {
        onSelectDrop({ address, lat, lng });
      }
    } catch (err) {
      const fallbackAddress = `Pin set at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      if (type === 'pickup') {
        onSelectPickup({ address: fallbackAddress, lat, lng });
        setActivePinType('drop');
      } else {
        onSelectDrop({ address: fallbackAddress, lat, lng });
      }
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=5`
      );
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data);
      if (data.length === 0) {
        setErrorMessage('No addresses found matching that query.');
      }
    } catch (err) {
      setErrorMessage('Address search service unavailable. Please click manually on the map.');
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (item: any) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const address = item.display_name;

    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 15);
    }

    if (activePinType === 'pickup') {
      onSelectPickup({ address, lat, lng });
      setActivePinType('drop');
    } else {
      onSelectDrop({ address, lat, lng });
    }

    setSearchResults([]);
    setSearchQuery('');
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 15);
        }
        reverseGeocodeSpecific(latitude, longitude, activePinType);
        setGpsLoading(false);
      },
      (error) => {
        setErrorMessage('Unable to retrieve location. Please grant permission or select manually.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex flex-col md:flex-row gap-2">
        {/* Toggle Pin Target */}
        <div className="grid grid-cols-2 bg-neutral-100 p-1 rounded-lg shrink-0">
          <button
            type="button"
            id="btn-select-pickup-pin"
            onClick={() => setActivePinType('pickup')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activePinType === 'pickup'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-500 fill-emerald-100" />
            Set Pickup
          </button>
          <button
            type="button"
            id="btn-select-drop-pin"
            onClick={() => setActivePinType('drop')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activePinType === 'drop'
                ? 'bg-white text-red-700 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-red-500 fill-red-100" />
            Set Destination
          </button>
        </div>

        {/* Address Search Field */}
        <form onSubmit={handleSearch} className="flex-1 relative flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              id="map-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activePinType} address...`}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-sans"
            />

            {/* Address Dropdown Results inside relative boundary */}
            {searchResults.length > 0 && (
              <div className="bg-white border border-neutral-200 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-neutral-100 z-[1000] absolute left-0 right-0 mt-1">
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    id={`address-search-result-${idx}`}
                    onClick={() => selectSearchResult(item)}
                    className="w-full text-left px-4 py-2.5 text-xs text-neutral-700 hover:bg-neutral-50 flex items-start gap-2 transition-all font-sans"
                  >
                    <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                    <span>{item.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="submit"
            id="btn-map-search-submit"
            disabled={isSearching}
            className="px-3 sm:px-4 py-2 text-xs font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 focus:outline-none disabled:opacity-50 shrink-0 font-sans"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
          </button>
          <button
            type="button"
            id="btn-gps-locate"
            disabled={gpsLoading}
            onClick={handleGetCurrentLocation}
            title="Use current GPS location"
            className="p-2 border border-neutral-300 bg-white rounded-lg hover:bg-neutral-50 text-neutral-600 disabled:opacity-50 shrink-0"
          >
            {gpsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-neutral-600" />
            ) : (
              <Navigation className="w-4 h-4 fill-neutral-600" />
            )}
          </button>
        </form>
      </div>

      {/* Map Container */}
      <div className="relative flex-1 min-h-[320px] rounded-xl overflow-hidden border border-neutral-300 shadow-inner bg-neutral-100">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Floating Instruction Map overlay Banner */}
        <div className="absolute bottom-3 left-3 right-3 bg-neutral-900/95 backdrop-blur-sm text-white py-2 px-3 rounded-lg text-[11px] font-sans flex items-center justify-between gap-2 shadow-lg z-[1000] pointer-events-auto">
          <p className="leading-snug">
            {activePinType === 'pickup' ? (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Click on the map or search to place <strong className="text-emerald-300">Pickup Pin</strong>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" />
                Click on the map or search to place <strong className="text-red-300">Destination Pin</strong>
              </span>
            )}
          </p>
          <span className="text-[10px] bg-neutral-750 px-2 py-0.5 rounded border border-neutral-700 uppercase tracking-widest text-neutral-300">
            Leaflet Map
          </span>
        </div>
      </div>

      {errorMessage && (
        <p className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded-md border border-red-200">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
