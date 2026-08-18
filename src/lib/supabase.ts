/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Inquiry, InquiryStatus, ServiceType, VehicleCategory, Booking, Driver, Vehicle, GeneralSettings } from '../types';

// Read configuration from environment variables
const getSupabaseConfig = () => {
  const metaEnv = (import.meta as any).env || {};
  
  // Safely get process.env if available, with fallbacks
  let processEnv: Record<string, string> = {};
  try {
    if (typeof process !== 'undefined' && process.env) {
      processEnv = process.env as any;
    }
  } catch (e) {
    // ignore
  }

  // Support VITE_, NEXT_PUBLIC_, and other standard Supabase env variable conventions
  const finalUrl = (
    metaEnv.VITE_SUPABASE_URL ||
    metaEnv.VITE_NEXT_PUBLIC_SUPABASE_URL ||
    metaEnv.NEXT_PUBLIC_SUPABASE_URL ||
    processEnv.VITE_SUPABASE_URL ||
    processEnv.NEXT_PUBLIC_SUPABASE_URL ||
    processEnv.VITE_NEXT_PUBLIC_SUPABASE_URL ||
    processEnv.SUPABASE_URL ||
    ''
  ).trim();

  const finalKey = (
    metaEnv.VITE_SUPABASE_ANON_KEY ||
    metaEnv.VITE_NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    processEnv.VITE_SUPABASE_ANON_KEY ||
    processEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    processEnv.VITE_NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    processEnv.SUPABASE_ANON_KEY ||
    ''
  ).trim();

  const isDummyUrl = 
    !finalUrl ||
    finalUrl.includes('your-project-id') || 
    finalUrl.includes('example.supabase.co') ||
    finalUrl.includes('placeholder') ||
    finalKey.includes('your-anon-publishable-key') ||
    finalKey.includes('placeholder');

  const isConfigured = !isDummyUrl && finalUrl.length > 10 && finalKey.length > 10;

  // Mask sensitive database URL and Key details for secure production console verification
  const maskedUrl = finalUrl ? `${finalUrl.substring(0, 15)}...${finalUrl.substring(finalUrl.length - 4 || 0)}` : 'NOT_FOUND';
  const maskedKey = finalKey ? `${finalKey.substring(0, 8)}...${finalKey.substring(finalKey.length - 4 || 0)}` : 'NOT_FOUND';

  console.log('[Supabase Client Initialization Debug]:', {
    urlAvailable: !!finalUrl,
    urlMasked: maskedUrl,
    keyAvailable: !!finalKey,
    keyMasked: maskedKey,
    isConfigured
  });

  return {
    url: finalUrl,
    anonKey: finalKey,
    isConfigured,
  };
};

export const config = getSupabaseConfig();

let supabaseClient: SupabaseClient | null = null;
if (config.isConfigured) {
  try {
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    });
    console.log('[Supabase Service Success] Client initialized successfully.');
  } catch (error) {
    console.error('[Supabase Service Error] Failed to initialize Supabase client:', error);
  }
} else {
  console.warn('[Supabase Service Warning] Client not initialized. Missing environment configurations.');
}

// Memory/LocalStorage cache for local sandbox testing if Supabase is not connected yet
const LOCAL_STORAGE_KEY = 'car_driver_inquiries_v1';

const getLocalInquiries = (): Inquiry[] => {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

const saveLocalInquiries = (inquiries: Inquiry[]) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(inquiries));
  // Dispatch a global event for immediate reactivity inside the browser tab
  window.dispatchEvent(new CustomEvent('supabase-realtime-inquiry', { detail: inquiries }));
};

export const SupabaseService = {
  isUsingFallback(): boolean {
    return !config.isConfigured || supabaseClient === null;
  },

  getCredentials(): { url: string; anonKey: string } {
    return {
      url: config.url,
      anonKey: config.anonKey,
    };
  },

  async queryInquiries(): Promise<Inquiry[]> {
    console.log('[Supabase Service] queryInquiries called.');
    if (supabaseClient) {
      try {
        console.log('[Supabase Service] Performing SELECT on public.inquiries...');
        const { data, error } = await supabaseClient
          .from('inquiries')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[Supabase Service error] queryInquiries database error details:', error);
          throw error;
        }

        console.log(`[Supabase Service success] Fetch completed successfully. Received ${data?.length || 0} inquiry records.`);
        return (data || []) as Inquiry[];
      } catch (err: any) {
        console.error('[Supabase Service fetch failure] queryInquiries failed. Falling back to local state:', err);
        return getLocalInquiries();
      }
    }
    console.warn('[Supabase Service warning] Supabase client is not initialized. Using local memory storage fallback.');
    return getLocalInquiries();
  },

  async insertInquiry(inquiryData: Omit<Inquiry, 'id' | 'created_at' | 'status'>): Promise<Inquiry> {
    const newInquiry: Inquiry = {
      ...inquiryData,
      id: crypto.randomUUID(),
      status: 'New',
      created_at: new Date().toISOString(),
    };

    console.log('[Supabase Service] insertInquiry called with payload:', newInquiry);

    if (supabaseClient) {
      try {
        console.log('[Supabase Service] Performing INSERT into public.inquiries...');
        const { data, error } = await supabaseClient
          .from('inquiries')
          .insert([
            {
              id: newInquiry.id,
              name: newInquiry.name,
              phone: newInquiry.phone,
              service_type: newInquiry.service_type,
              pickup_location: newInquiry.pickup_location,
              pickup_latitude: newInquiry.pickup_latitude,
              pickup_longitude: newInquiry.pickup_longitude,
              drop_location: newInquiry.drop_location,
              drop_latitude: newInquiry.drop_latitude,
              drop_longitude: newInquiry.drop_longitude,
              travel_date: newInquiry.travel_date,
              additional_requirements: newInquiry.additional_requirements,
              status: newInquiry.status,
              vehicle_category: newInquiry.vehicle_category,
            }
          ])
          .select();

        if (error) {
          console.error('[Supabase Service error] insertInquiry database error details:', error);
          throw error;
        }

        if (data && data[0]) {
          console.log('[Supabase Service success] Record inserted successfully:', data[0]);
          return data[0] as Inquiry;
        }
      } catch (err: any) {
        console.error('[Supabase Service write failure] insertInquiry failed. Falling back to local state simulation:', err);
      }
    }

    // fallback simulation
    console.warn('[Supabase Service warning] Supabase client is not initialized or write failed. Falling back to local state.');
    const currentList = getLocalInquiries();
    const updated = [newInquiry, ...currentList];
    saveLocalInquiries(updated);
    return newInquiry;
  },

  async updateStatus(id: string, status: InquiryStatus): Promise<boolean> {
    console.log(`[Supabase Service] updateStatus called for ID: ${id}, status: ${status}`);
    if (supabaseClient) {
      try {
        console.log('[Supabase Service] Performing UPDATE on public.inquiries...');
        const { error } = await supabaseClient
          .from('inquiries')
          .update({ status })
          .eq('id', id);

        if (error) {
          console.error('[Supabase Service error] updateStatus database error details:', error);
          throw error;
        }

        console.log(`[Supabase Service success] Update status complete for ID: ${id}`);
        return true;
      } catch (err: any) {
        console.error('[Supabase Service failure] updateStatus failed:', err);
      }
    }

    console.warn('[Supabase Service warning] Supabase client not initialized or update failed. Updating local mock state.');
    const currentList = getLocalInquiries();
    const index = currentList.findIndex((item) => item.id === id);
    if (index !== -1) {
      currentList[index].status = status;
      saveLocalInquiries([...currentList]);
      return true;
    }
    return false;
  },

  async deleteInquiry(id: string): Promise<boolean> {
    console.log(`[Supabase Service] deleteInquiry called for ID: ${id}`);
    if (supabaseClient) {
      try {
        console.log('[Supabase Service] Performing DELETE on public.inquiries...');
        const { error } = await supabaseClient
          .from('inquiries')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('[Supabase Service error] deleteInquiry database error details:', error);
          throw error;
        }

        console.log(`[Supabase Service success] Deleted ID: ${id} successfully from database.`);
        return true;
      } catch (err: any) {
        console.error('[Supabase Service failure] deleteInquiry failed:', err);
      }
    }

    console.warn('[Supabase Service warning] Supabase client not initialized or delete failed. Updating local mock state.');
    const currentList = getLocalInquiries();
    const filtered = currentList.filter((item) => item.id !== id);
    saveLocalInquiries(filtered);
    return true;
  },

  /**
   * Listens to realtime events.
   * Leverages real Supabase realtime channels or falls back to our atomic window event router.
   */
  subscribeToInquiries(onEvent: (inquiry: Inquiry, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void): () => void {
    let activeChannel: any = null;

    if (supabaseClient) {
      try {
        activeChannel = supabaseClient
          .channel('inquiries-realtime-channel')
          .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'inquiries' },
              (payload) => {
                const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
                const nextRecord = (payload.new || payload.old) as Inquiry;
                if (nextRecord) {
                  onEvent(nextRecord, eventType);
                }
              }
          )
          .subscribe();
      } catch (err) {
        console.error('Supabase Realtime subscription error:', err);
      }
    }

    // fallback simulation event handler
    const localChangeHandler = (e: Event) => {
      const customEvent = e as CustomEvent<Inquiry[]>;
      // For fallback simulation, when a change is detected, we reload all or detect added
      // To simulate individual events, we trigger the callback.
      // We'll just trigger an INSERT event with the first element or direct reload
      const nextList = customEvent.detail;
      const prevListVal = localStorage.getItem('prev_car_driver_inquiries_ref');
      const prevList: Inquiry[] = prevListVal ? JSON.parse(prevListVal) : [];

      localStorage.setItem('prev_car_driver_inquiries_ref', JSON.stringify(nextList));

      if (nextList.length > prevList.length) {
        const added = nextList.find((item) => !prevList.some((p) => p.id === item.id));
        if (added) {
          onEvent(added, 'INSERT');
        }
      } else if (nextList.length < prevList.length) {
        // deleted
        onEvent({ id: 'any' } as Inquiry, 'DELETE');
      } else {
        // updated status
        const updated = nextList.find((item) => {
          const matched = prevList.find((p) => p.id === item.id);
          return matched && matched.status !== item.status;
        });
        if (updated) {
          onEvent(updated, 'UPDATE');
        }
      }
    };

    window.addEventListener('supabase-realtime-inquiry', localChangeHandler);

    return () => {
      if (activeChannel) {
        try {
          supabaseClient?.removeChannel(activeChannel);
        } catch (err) {
          console.error('Failed to cleanup Supabase channel', err);
        }
      }
      window.removeEventListener('supabase-realtime-inquiry', localChangeHandler);
    };
  },

  async getServiceFares(): Promise<Record<string, { base: number; rate: number }>> {
    const defaultConfigs: Record<string, { base: number; rate: number }> = {
      'Fleet Booking': { base: 50.00, rate: 15.00 },
      'Driver Relief': { base: 100.00, rate: 10.00 },
      'Outstation Trip': { base: 150.00, rate: 12.00 },
      'Wedding Booking': { base: 500.00, rate: 25.00 },
      'Custom Requirement': { base: 200.00, rate: 18.00 },
    };

    if (supabaseClient) {
      try {
        console.log('[Supabase Service] querySettings called for key: "service_fares" on settings table');
        const { data, error } = await supabaseClient
          .from('settings')
          .select('value')
          .eq('key', 'service_fares')
          .maybeSingle();

        if (error) {
          console.warn('[Supabase Service warning] Error fetching service_fares from settings table, trying system_settings fallback:', error);
          const { data: altData, error: altError } = await supabaseClient
            .from('system_settings')
            .select('value')
            .eq('key', 'service_fares')
            .maybeSingle();

          if (altError) {
            console.error('[Supabase Service error] Error fetching service_fares from system_settings fallback:', altError);
          } else if (altData && altData.value) {
            console.log('[Supabase Service success] Loaded service_fares from fallback system_settings table', altData.value);
            const parsed = typeof altData.value === 'string' ? JSON.parse(altData.value) : altData.value;
            return { ...defaultConfigs, ...parsed };
          }
        } else if (data && data.value) {
          console.log('[Supabase Service success] Loaded service_fares from settings table', data.value);
          const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          return { ...defaultConfigs, ...parsed };
        }
      } catch (err) {
        console.warn('[Supabase Service warn] Exception fetching service_fares:', err);
      }
    }

    // Fallback to localStorage or default
    try {
      const saved = localStorage.getItem('admin_service_fares');
      if (saved) {
        return { ...defaultConfigs, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return defaultConfigs;
  },

  async saveServiceFares(fares: Record<string, { base: number; rate: number }>): Promise<boolean> {
    // 1. Save to local storage for quick offline / single sandbox caching
    try {
      localStorage.setItem('admin_service_fares', JSON.stringify(fares));
      // Dispatch custom event for real-time reactivity in custom UI components
      window.dispatchEvent(new CustomEvent('supabase-settings-updated', { detail: fares }));
    } catch (e) {
      console.error('Failed to save service_fares locally:', e);
    }

    // 2. Save to Supabase settings table if configured
    if (supabaseClient) {
      try {
        console.log('[Supabase Service] upserting to settings table: key: "service_fares"');
        const { error } = await supabaseClient
          .from('settings')
          .upsert({
            key: 'service_fares',
            value: fares,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });

        if (error) {
          console.warn('[Supabase Service warning] Failed to upsert service_fares to settings table, trying system_settings fallback:', error);
          const { error: altError } = await supabaseClient
            .from('system_settings')
            .upsert({
              key: 'service_fares',
              value: fares,
              updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

          if (altError) {
            console.error('[Supabase Service error] Failed to upsert service_fares to system_settings table fallback either:', altError);
            throw altError;
          }
        }

        console.log('[Supabase Service success] Service fares saved successfully.');
        return true;
      } catch (err: any) {
        console.error('[Supabase Service fail] saveServiceFares exception:', err);
        return false;
      }
    }
    return true;
  },

  async getVehicleCategories(): Promise<VehicleCategory[]> {
    if (supabaseClient) {
      try {
        console.log('[Supabase Service] query fetch called for table "vehicle_categories"');
        const { data, error } = await supabaseClient
          .from('vehicle_categories')
          .select('*')
          .order('name', { ascending: true });

        if (error) {
          console.warn('[Supabase Service warning] Could not query vehicle_categories table, using fallback:', error.message || error);
        } else if (data && data.length > 0) {
          console.log('[Supabase Service Debug] Data received from Supabase', data);
          return (data as any[]).map((row: any) => {
            let name = row.name || '';
            let status: 'Available' | 'Under Maintenance' | 'Archived' = row.status || (row.active ? 'Available' : 'Under Maintenance');
            let image_url = row.image_url || '';
            let description = row.description || '';

            // Decouple fallback serialization if name uses the delimiter
            if (name.includes('|||')) {
              const parts = name.split('|||');
              name = parts[0];
              status = (parts[1] as any) || status;
              image_url = parts[2] || image_url;
              description = parts[3] || description;
            }

            return {
              ...row,
              name,
              status,
              image_url,
              description,
              active: status === 'Available'
            } as VehicleCategory;
          });
        }
      } catch (err: any) {
        console.warn('[Supabase Service warning] Exception querying vehicle_categories table, falling back to local data:', err?.message || err);
      }
    }

    // Check cached local storage categories if any
    try {
      const cached = localStorage.getItem('admin_vehicle_categories');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    // fallback when Supabase connection is offline/local mock context
    const defaultConfigs: VehicleCategory[] = [
      { id: 'hatchback', name: 'Hatchback', base_fare: 100.00, per_km_rate: 10.00, minimum_fare: 100.00, active: true, status: 'Available', passenger_capacity: 4, luggage_capacity: 2 },
      { id: 'sedan', name: 'Sedan', base_fare: 150.00, per_km_rate: 12.00, minimum_fare: 150.00, active: true, status: 'Available', passenger_capacity: 4, luggage_capacity: 3 },
      { id: 'premium-sedan', name: 'Premium Sedan', base_fare: 250.00, per_km_rate: 15.00, minimum_fare: 250.00, active: true, status: 'Available', passenger_capacity: 4, luggage_capacity: 3 },
      { id: 'suv', name: 'SUV', base_fare: 200.00, per_km_rate: 15.00, minimum_fare: 200.00, active: true, status: 'Available', passenger_capacity: 6, luggage_capacity: 5 },
      { id: 'premium-suv', name: 'Premium SUV', base_fare: 350.00, per_km_rate: 20.00, minimum_fare: 350.00, active: true, status: 'Available', passenger_capacity: 6, luggage_capacity: 5 },
      { id: 'innova-mpv', name: 'Innova / MPV Tier', base_fare: 250.00, per_km_rate: 16.00, minimum_fare: 250.00, active: true, status: 'Available', passenger_capacity: 7, luggage_capacity: 6 },
      { id: 'tempo-traveller', name: 'Tempo Traveller Cruiser', base_fare: 500.00, per_km_rate: 25.00, minimum_fare: 500.00, active: true, status: 'Available', passenger_capacity: 16, luggage_capacity: 12 },
    ];
    return defaultConfigs;
  },

  async saveVehicleCategories(categories: VehicleCategory[]): Promise<{ success: boolean; error?: string }> {
    if (supabaseClient) {
      try {
        console.log('[Supabase Service Debug] Saving vehicle categories to public.vehicle_categories table...');
        
        // Attempt 1: Try to save with full modern columns (status, image_url, description)
        const payloadWithFields = categories.map(cat => ({
          id: cat.id || crypto.randomUUID(),
          name: cat.name,
          base_fare: Number(cat.base_fare),
          per_km_rate: Number(cat.per_km_rate),
          minimum_fare: Number(cat.minimum_fare),
          passenger_capacity: cat.passenger_capacity ?? 4,
          luggage_capacity: cat.luggage_capacity ?? 2,
          active: cat.status ? cat.status === 'Available' : cat.active,
          status: cat.status || (cat.active ? 'Available' : 'Under Maintenance'),
          image_url: cat.image_url || '',
          description: cat.description || '',
          updated_at: new Date().toISOString()
        }));

        const { error: fullError } = await supabaseClient
          .from('vehicle_categories')
          .upsert(payloadWithFields, { onConflict: 'id' });

        if (!fullError) {
          console.log('[Supabase Service success] Saved vehicle categories successfully with full columns.');
        } else {
          console.warn('[Supabase Service warning] Upsert with full columns failed (likely missing columns), trying fallback serialization...', fullError);
          
          // Attempt 2: Fallback serialization inside name column to support all schemas resilience
          const payloadFallback = categories.map(cat => {
            const statusVal = cat.status || (cat.active ? 'Available' : 'Under Maintenance');
            const imgVal = cat.image_url || '';
            const descVal = cat.description || '';
            const serializedName = `${cat.name}|||${statusVal}|||${imgVal}|||${descVal}`;
            
            return {
              id: cat.id || crypto.randomUUID(),
              name: serializedName,
              base_fare: Number(cat.base_fare),
              per_km_rate: Number(cat.per_km_rate),
              minimum_fare: Number(cat.minimum_fare),
              passenger_capacity: cat.passenger_capacity ?? 4,
              luggage_capacity: cat.luggage_capacity ?? 2,
              active: statusVal === 'Available',
              updated_at: new Date().toISOString()
            };
          });

          const { error: fallbackError } = await supabaseClient
            .from('vehicle_categories')
            .upsert(payloadFallback, { onConflict: 'id' });

          if (fallbackError) {
            console.error('[Supabase Service error] Dynamic fallback save failed:', fallbackError);
            return { success: false, error: `${fallbackError.message || 'Unknown database error'} (Code: ${fallbackError.code || 'N/A'})` };
          }
          console.log('[Supabase Service success] Saved vehicle categories successfully using fallback serialization.');
        }
      } catch (err: any) {
        console.error('[Supabase Service fail] saveVehicleCategories exception during database write:', err);
        return { success: false, error: err.message || 'Exception during database write' };
      }
    } else {
      console.warn('[Supabase Service warning] Supabase client is not initialized. Saving to localStorage fallback only.');
    }

    // Save to localStorage and dispatch update events after/if Supabase sync succeeds
    try {
      console.log('[Supabase Service Cache] Updating local storage cache with saved vehicle categories:', categories);
      localStorage.setItem('admin_vehicle_categories', JSON.stringify(categories));
      window.dispatchEvent(new CustomEvent('supabase-vehicle-categories-updated', { detail: categories }));
    } catch (e: any) {
      console.error('Failed to save vehicle categories locally after Supabase sync:', e);
      return { success: false, error: `Saved to database, but failed local storage cache update: ${e.message}` };
    }

    return { success: true };
  },

  async queryBookings(): Promise<Booking[]> {
    console.log('[Supabase Service] queryBookings called.');
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('bookings')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[Supabase Service error] queryBookings error:', error);
          throw error;
        }
        return (data || []) as Booking[];
      } catch (err: any) {
        console.error('[Supabase Service query failure] Falling back to local bookings storage:', err);
        return getLocalBookings();
      }
    }
    return getLocalBookings();
  },

  async insertBooking(bookingData: Omit<Booking, 'id' | 'created_at'>): Promise<Booking> {
    const newBooking: Booking = {
      ...bookingData,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    console.log('[Supabase Service] insertBooking payload:', newBooking);

    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('bookings')
          .insert([newBooking])
          .select();

        if (error) {
          console.error('[Supabase Service error] insertBooking error:', error);
          throw error;
        }

        if (data && data[0]) {
          console.log('[Supabase Service success] Booking inserted to Supabase:', data[0]);
          return data[0] as Booking;
        }
      } catch (err: any) {
        console.error('[Supabase Service write failure] insertBooking failed. Falling back to local bookings storage:', err);
      }
    }

    const current = getLocalBookings();
    const updated = [newBooking, ...current];
    saveLocalBookings(updated);
    return newBooking;
  },

  async getBookingByDriverToken(token: string): Promise<Booking | null> {
    console.log('[Supabase Service] getBookingByDriverToken from inquiries:', token);
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('inquiries')
          .select('*')
          .eq('driver_token', token)
          .maybeSingle();

        if (error) {
          console.error('[Supabase Service error] getBookingByDriverToken error:', error);
          throw error;
        }
        if (data) return mapInquiryRowToBooking(data);
      } catch (err) {
        console.error('[Supabase Service query failure] getBookingByDriverToken fallback to local inquiries:', err);
      }
    }
    const current = getLocalInquiries();
    const matched = current.find(b => b.driver_token === token);
    return matched ? mapInquiryRowToBooking(matched) : null;
  },

  async getBookingByTrackingToken(token: string): Promise<Booking | null> {
    console.log('[Supabase Service] getBookingByTrackingToken from inquiries:', token);
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('inquiries')
          .select('*')
          .eq('tracking_token', token)
          .maybeSingle();

        if (error) {
          console.error('[Supabase Service error] getBookingByTrackingToken error:', error);
          throw error;
        }
        if (data) return mapInquiryRowToBooking(data);
      } catch (err) {
        console.error('[Supabase Service query failure] getBookingByTrackingToken fallback to local inquiries:', err);
      }
    }
    const current = getLocalInquiries();
    const matched = current.find(b => b.tracking_token === token);
    return matched ? mapInquiryRowToBooking(matched) : null;
  },

  async updateBookingCoords(bookingId: string, lat: number, lng: number, extra?: { speed?: number; heading?: number; trip_status?: 'confirmed' | 'driver_en_route' | 'driver_arrived' | 'trip_in_progress' | 'completed' | 'en_route_pickup' | 'arrived_pickup' | 'trip_started' | 'trip_completed' }): Promise<boolean> {
    console.log('[Supabase Service] updateBookingCoords on inquiries:', bookingId, lat, lng, extra);
    if (supabaseClient) {
      try {
        const updatePayload: any = { 
          driver_latitude: lat, 
          driver_longitude: lng,
          last_location_update: new Date().toISOString()
        };
        if (extra?.trip_status) {
          updatePayload.trip_status = extra.trip_status;
          const isActive = (
            extra.trip_status === 'driver_en_route' || 
            extra.trip_status === 'driver_arrived' || 
            extra.trip_status === 'trip_in_progress' ||
            extra.trip_status === 'en_route_pickup' ||
            extra.trip_status === 'arrived_pickup' ||
            extra.trip_status === 'trip_started'
          );
          updatePayload.status = isActive ? 'Active' : (extra.trip_status === 'completed' || extra.trip_status === 'trip_completed' ? 'Completed' : 'Confirmed');
        }

        const { error } = await supabaseClient
          .from('inquiries')
          .update(updatePayload)
          .eq('id', bookingId);

        if (error) {
          console.warn('[Supabase Service warning] updateBookingCoords full schema error, retrying standard schema:', error);
          const standardPayload: any = { driver_latitude: lat, driver_longitude: lng };
          if (extra?.trip_status) {
            const isActive = (
              extra.trip_status === 'driver_en_route' || 
              extra.trip_status === 'driver_arrived' || 
              extra.trip_status === 'trip_in_progress' ||
              extra.trip_status === 'en_route_pickup' ||
              extra.trip_status === 'arrived_pickup' ||
              extra.trip_status === 'trip_started'
            );
            standardPayload.status = isActive ? 'Active' : (extra.trip_status === 'completed' || extra.trip_status === 'trip_completed' ? 'Completed' : 'Confirmed');
          }
          const { error: error2 } = await supabaseClient
            .from('inquiries')
            .update(standardPayload)
            .eq('id', bookingId);
          if (error2) throw error2;
        }
        return true;
      } catch (err) {
        console.error('[Supabase Service failure] updateBookingCoords exception, using local fallback:', err);
      }
    }
    const current = getLocalInquiries();
    const idx = current.findIndex(b => b.id === bookingId);
    if (idx !== -1) {
      current[idx].driver_latitude = lat;
      current[idx].driver_longitude = lng;
      current[idx].last_location_update = new Date().toISOString();
      if (extra?.trip_status) {
        current[idx].trip_status = extra.trip_status;
        const isActive = (
          extra.trip_status === 'driver_en_route' || 
          extra.trip_status === 'driver_arrived' || 
          extra.trip_status === 'trip_in_progress' ||
          extra.trip_status === 'en_route_pickup' ||
          extra.trip_status === 'arrived_pickup' ||
          extra.trip_status === 'trip_started'
        );
        current[idx].status = isActive ? 'Active' : (extra.trip_status === 'completed' || extra.trip_status === 'trip_completed' ? 'Completed' : 'Confirmed');
      }
      saveLocalInquiries([...current]);
      return true;
    }
    return false;
  },

  async startBookingTrip(bookingId: string): Promise<boolean> {
    const timestamp = new Date().toISOString();
    console.log('[Supabase Service] startBookingTrip on inquiries:', bookingId, timestamp);
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('inquiries')
          .update({ 
            status: 'Active', 
            trip_status: 'en_route_pickup',
            trip_started_at: timestamp 
          })
          .eq('id', bookingId);

        if (error) {
          console.warn('[Supabase Service error] startBookingTrip full schema error, retrying standard schema:', error);
          const { error: error2 } = await supabaseClient
            .from('inquiries')
            .update({ status: 'Active', trip_started_at: timestamp })
            .eq('id', bookingId);
          if (error2) throw error2;
        }
        return true;
      } catch (err) {
        console.error('[Supabase Service failure] startBookingTrip exception, using local fallback:', err);
      }
    }
    const current = getLocalInquiries();
    const idx = current.findIndex(b => b.id === bookingId);
    if (idx !== -1) {
      current[idx].status = 'Active';
      current[idx].trip_status = 'en_route_pickup';
      current[idx].trip_started_at = timestamp;
      saveLocalInquiries([...current]);
      return true;
    }
    return false;
  },

  async completeBookingTrip(bookingId: string): Promise<boolean> {
    const timestamp = new Date().toISOString();
    console.log('[Supabase Service] completeBookingTrip on inquiries:', bookingId, timestamp);
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('inquiries')
          .update({ 
            status: 'Completed', 
            trip_status: 'trip_completed',
            trip_completed_at: timestamp 
          })
          .eq('id', bookingId);

        if (error) {
          console.warn('[Supabase Service error] completeBookingTrip full schema error, retrying standard schema:', error);
          const { error: error2 } = await supabaseClient
            .from('inquiries')
            .update({ status: 'Completed', trip_completed_at: timestamp })
            .eq('id', bookingId);
          if (error2) throw error2;
        }
        return true;
      } catch (err) {
        console.error('[Supabase Service failure] completeBookingTrip exception, using local fallback:', err);
      }
    }
    const current = getLocalInquiries();
    const idx = current.findIndex(b => b.id === bookingId);
    if (idx !== -1) {
      current[idx].status = 'Completed';
      current[idx].trip_status = 'trip_completed';
      current[idx].trip_completed_at = timestamp;
      saveLocalInquiries([...current]);
      return true;
    }
    return false;
  },

  subscribeToBookingRealtime(bookingId: string, onUpdate: (booking: Booking) => void): () => void {
    let activeChannel: any = null;
    if (supabaseClient) {
      try {
        activeChannel = supabaseClient
          .channel(`booking-channel-${bookingId}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'inquiries', filter: `id=eq.${bookingId}` },
            (payload) => {
              const nextRecord = payload.new as any;
              if (nextRecord) {
                const mapped = mapInquiryRowToBooking(nextRecord);
                if (mapped) onUpdate(mapped);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Supabase booking realtime subscribe error:', err);
      }
    }

    const localChangeHandler = (e: Event) => {
      const customEvent = e as CustomEvent<Inquiry[]>;
      const matched = customEvent.detail.find(b => b.id === bookingId);
      if (matched) {
        const mapped = mapInquiryRowToBooking(matched);
        if (mapped) onUpdate(mapped);
      }
    };

    window.addEventListener('supabase-realtime-inquiry', localChangeHandler);

    return () => {
      if (activeChannel) {
        try {
          supabaseClient?.removeChannel(activeChannel);
        } catch (err) {
          console.error('Failed to cleanup Supabase booking channel', err);
        }
      }
      window.removeEventListener('supabase-realtime-inquiry', localChangeHandler);
    };
  },

  async confirmInquiry(
    id: string,
    driverName: string,
    driverPhone: string,
    vehicleNumber: string,
    driverToken: string,
    trackingToken: string,
    additionalRequirements?: string | null,
    driverId?: string | null,
    vehicleId?: string | null
  ): Promise<Inquiry | null> {
    console.log('[Supabase Service] confirmInquiry:', id, { driverId, vehicleId });
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('inquiries')
          .update({
            status: 'Confirmed',
            driver_name: driverName,
            driver_phone: driverPhone,
            vehicle_number: vehicleNumber,
            driver_token: driverToken,
            tracking_token: trackingToken,
            additional_requirements: additionalRequirements,
            driver_id: driverId || null,
            vehicle_id: vehicleId || null
          })
          .eq('id', id)
          .select()
          .maybeSingle();

        if (error) {
          console.warn('[Supabase Service warning] confirmInquiry full schema failed, retrying without driver_id/vehicle_id columns:', error);
          const { data: fallbackData, error: fallbackError } = await supabaseClient
            .from('inquiries')
            .update({
              status: 'Confirmed',
              driver_name: driverName,
              driver_phone: driverPhone,
              vehicle_number: vehicleNumber,
              driver_token: driverToken,
              tracking_token: trackingToken,
              additional_requirements: additionalRequirements
            })
            .eq('id', id)
            .select()
            .maybeSingle();
          if (fallbackError) throw fallbackError;
          return fallbackData as Inquiry;
        }
        return data as Inquiry;
      } catch (err) {
        console.error('[Supabase Service failure] confirmInquiry failed, using local fallback:', err);
      }
    }

    const currentList = getLocalInquiries();
    const index = currentList.findIndex((item) => item.id === id);
    if (index !== -1) {
      currentList[index] = {
        ...currentList[index],
        status: 'Confirmed',
        driver_name: driverName,
        driver_phone: driverPhone,
        vehicle_number: vehicleNumber,
        driver_token: driverToken,
        tracking_token: trackingToken,
        additional_requirements: additionalRequirements || currentList[index].additional_requirements,
        driver_id: driverId || null,
        vehicle_id: vehicleId || null
      };
      saveLocalInquiries([...currentList]);
      return currentList[index];
    }
    return null;
  },

  // --- Drivers Management ---
  async getDrivers(): Promise<Driver[]> {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('drivers')
          .select('*')
          .order('name', { ascending: true });
        if (!error && data) {
          return data as Driver[];
        }
        if (error) {
          console.warn('[Supabase Service warning] Error querying drivers table:', error);
        }
      } catch (err) {
        console.warn('[Supabase Service warning] Exception querying drivers table:', err);
      }
    }
    const stored = localStorage.getItem('fleet_drivers');
    return stored ? JSON.parse(stored) : [];
  },

  async saveDrivers(drivers: Driver[]): Promise<{ success: boolean; error?: string }> {
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('drivers')
          .upsert(drivers, { onConflict: 'id' });
        if (!error) {
          console.log('[Supabase Service success] Drivers saved successfully to DB.');
        } else {
          console.warn('[Supabase Service warning] Drivers upsert error, trying to write clean records:', error);
        }
      } catch (err: any) {
        console.warn('[Supabase Service warning] Drivers exception during DB write:', err);
      }
    }
    try {
      localStorage.setItem('fleet_drivers', JSON.stringify(drivers));
      window.dispatchEvent(new CustomEvent('supabase-drivers-updated', { detail: drivers }));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async deleteDriver(driverId: string): Promise<{ success: boolean; error?: string }> {
    // 1. Check if driver is assigned to any active or historical bookings in Supabase
    if (supabaseClient) {
      try {
        const { data: bookings, error: checkError } = await supabaseClient
          .from('inquiries')
          .select('id, driver_name')
          .eq('driver_id', driverId);
        
        if (!checkError && bookings && bookings.length > 0) {
          return { 
            success: false, 
            error: `Cannot delete driver because they are assigned to ${bookings.length} active or historical booking(s).` 
          };
        }
      } catch (err) {
        console.warn('[Supabase Service warning] Exception checking driver bookings:', err);
      }
    }

    // Also check local storage inquiries as fallback or for consistency
    try {
      const storedInquiries = localStorage.getItem('fleet_inquiries');
      if (storedInquiries) {
        const localInquiries: Inquiry[] = JSON.parse(storedInquiries);
        const assignedLocal = localInquiries.filter(inq => inq.driver_id === driverId);
        if (assignedLocal.length > 0) {
          return { 
            success: false, 
            error: `Cannot delete driver because they are assigned to ${assignedLocal.length} local booking(s).` 
          };
        }
      }
    } catch (e) {
      console.warn('[Supabase Service warning] Exception checking local inquiries:', e);
    }

    // 2. Perform delete in Supabase
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('drivers')
          .delete()
          .eq('id', driverId);
        
        if (error) {
          console.error('[Supabase Service error] Failed to delete driver from DB:', error);
          return { success: false, error: error.message };
        }
        console.log('[Supabase Service success] Driver deleted from DB.');
      } catch (err: any) {
        console.warn('[Supabase Service warning] Driver delete exception:', err);
        return { success: false, error: err.message };
      }
    }

    // 3. Update local storage & dispatch sync event
    try {
      const stored = localStorage.getItem('fleet_drivers');
      let updatedList: Driver[] = [];
      if (stored) {
        const driversList: Driver[] = JSON.parse(stored);
        updatedList = driversList.filter(d => d.id !== driverId);
        localStorage.setItem('fleet_drivers', JSON.stringify(updatedList));
      }
      window.dispatchEvent(new CustomEvent('supabase-drivers-updated', { detail: updatedList }));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // --- Vehicles Management ---
  async getVehicles(): Promise<Vehicle[]> {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('vehicles')
          .select('*')
          .order('vehicle_number', { ascending: true });
        if (!error && data) {
          return data as Vehicle[];
        }
        if (error) {
          console.warn('[Supabase Service warning] Error querying vehicles table:', error);
        }
      } catch (err) {
        console.warn('[Supabase Service warning] Exception querying vehicles table:', err);
      }
    }
    const stored = localStorage.getItem('fleet_vehicles');
    return stored ? JSON.parse(stored) : [];
  },

  async saveVehicles(vehicles: Vehicle[]): Promise<{ success: boolean; error?: string }> {
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('vehicles')
          .upsert(vehicles, { onConflict: 'id' });
        if (!error) {
          console.log('[Supabase Service success] Vehicles saved successfully to DB.');
        } else {
          console.warn('[Supabase Service warning] Vehicles upsert error:', error);
        }
      } catch (err: any) {
        console.warn('[Supabase Service warning] Vehicles exception during DB write:', err);
      }
    }
    try {
      localStorage.setItem('fleet_vehicles', JSON.stringify(vehicles));
      window.dispatchEvent(new CustomEvent('supabase-vehicles-updated', { detail: vehicles }));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // --- Settings Management ---
  async getSettings(): Promise<GeneralSettings> {
    const defaults: GeneralSettings = {
      company_name: 'Car & Driver Relief Services',
      company_logo: '',
      contact_number: '9876543210',
      email_address: 'admin@reliefservices.demo',
      office_address: '123 Elite Transit Plaza, Sector V, Salt Lake, Kolkata, West Bengal 700091, India',
      timezone: 'Asia/Kolkata'
    };
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('settings')
          .select('value')
          .eq('key', 'general_settings')
          .maybeSingle();
        if (!error && data && data.value) {
          const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          const merged = { ...defaults, ...parsed };
          if (merged.contact_number === '8637323873') merged.contact_number = defaults.contact_number;
          if (merged.email_address === 'bappa.admin@gmail.com') merged.email_address = defaults.email_address;
          if (merged.office_address === '123 Elite Transit Plaza, Sector V, Salt Lake, Kolkata, India') merged.office_address = defaults.office_address;
          return merged;
        }
      } catch (err) {
        console.warn('[Supabase Service warning] Exception getting settings:', err);
      }
    }
    const stored = localStorage.getItem('general_settings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const merged = { ...defaults, ...parsed };
        if (merged.contact_number === '8637323873') merged.contact_number = defaults.contact_number;
        if (merged.email_address === 'bappa.admin@gmail.com') merged.email_address = defaults.email_address;
        if (merged.office_address === '123 Elite Transit Plaza, Sector V, Salt Lake, Kolkata, India') merged.office_address = defaults.office_address;
        return merged;
      } catch {
        return defaults;
      }
    }
    return defaults;
  },

  async saveSettings(settings: GeneralSettings): Promise<{ success: boolean; error?: string }> {
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('settings')
          .upsert({
            key: 'general_settings',
            value: settings,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
        if (!error) {
          console.log('[Supabase Service success] Settings saved successfully to DB.');
        } else {
          console.warn('[Supabase Service warning] Settings upsert error:', error);
        }
      } catch (err: any) {
        console.warn('[Supabase Service warning] Settings exception:', err);
      }
    }
    try {
      localStorage.setItem('general_settings', JSON.stringify(settings));
      window.dispatchEvent(new CustomEvent('supabase-settings-updated', { detail: settings }));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
};

// Helper mapper to transform an inquiry's status & track attributes into Booking representation.
export function mapInquiryRowToBooking(inq: any): Booking | null {
  if (!inq) return null;
  
  const rawStatus = inq.status;
  let statusMapped: 'Pending' | 'Confirmed' | 'Active' | 'Completed' = 'Confirmed';
  if (rawStatus === 'Completed' || rawStatus === 'completed' || rawStatus === 'trip_completed') {
    statusMapped = 'Completed';
  } else if (
    rawStatus === 'Active' || 
    rawStatus === 'driver_en_route' || 
    rawStatus === 'driver_arrived' || 
    rawStatus === 'trip_in_progress' ||
    rawStatus === 'en_route_pickup' ||
    rawStatus === 'arrived_pickup' ||
    rawStatus === 'trip_started'
  ) {
    statusMapped = 'Active';
  } else if (rawStatus === 'Confirmed' || rawStatus === 'confirmed') {
    statusMapped = 'Confirmed';
  } else if (rawStatus === 'New' || rawStatus === 'Pending') {
    statusMapped = 'Pending';
  }

  // Derive trip status if not directly present in DB
  let derivedTripStatus = inq.trip_status || (
    rawStatus === 'Completed' || rawStatus === 'completed' || rawStatus === 'trip_completed' ? 'trip_completed' :
    rawStatus === 'driver_arrived' || rawStatus === 'arrived_pickup' ? 'arrived_pickup' :
    rawStatus === 'trip_in_progress' || rawStatus === 'trip_started' ? 'trip_started' :
    rawStatus === 'driver_en_route' || rawStatus === 'en_route_pickup' || rawStatus === 'Active' ? 'en_route_pickup' :
    rawStatus === 'Confirmed' || rawStatus === 'confirmed' ? 'confirmed' : 'confirmed'
  );

  // Coerce old states to official ones to guarantee uniformity throughout the app:
  if (derivedTripStatus === 'driver_en_route') derivedTripStatus = 'en_route_pickup';
  if (derivedTripStatus === 'driver_arrived') derivedTripStatus = 'arrived_pickup';
  if (derivedTripStatus === 'trip_in_progress') derivedTripStatus = 'trip_started';
  if (derivedTripStatus === 'completed') derivedTripStatus = 'trip_completed';

  return {
    id: inq.id,
    customer_name: inq.customer_name || inq.name || 'Customer',
    customer_phone: inq.customer_phone || inq.phone || '',
    pickup_location: inq.pickup_location || 'Not Specified',
    destination_location: inq.drop_location || inq.destination_location || 'Not Specified',
    booking_date: inq.booking_date || inq.travel_date || '',
    booking_time: inq.booking_time || (inq.additional_requirements?.match(/Scheduled Departure:\s*([^\n\r]+)/)?.[1]) || '12:00 PM',
    status: statusMapped,
    trip_status: derivedTripStatus,
    last_location_update: inq.last_location_update || inq.updated_at || null,
    driver_name: inq.driver_name || null,
    driver_phone: inq.driver_phone || null,
    vehicle_number: inq.vehicle_number || null,
    driver_id: inq.driver_id || null,
    vehicle_id: inq.vehicle_id || null,
    driver_token: inq.driver_token || null,
    tracking_token: inq.tracking_token || null,
    started_at: inq.trip_started_at || null,
    completed_at: inq.trip_completed_at || null,
    last_latitude: inq.driver_latitude || null,
    last_longitude: inq.driver_longitude || null,
    pickup_latitude: inq.pickup_latitude || null,
    pickup_longitude: inq.pickup_longitude || null,
    drop_latitude: inq.drop_latitude || null,
    drop_longitude: inq.drop_longitude || null,
    created_at: inq.created_at || new Date().toISOString(),
  };
}

// Local storage booking helpers
const LOCAL_BOOKINGS_KEY = 'car_driver_bookings_v2';

const getLocalBookings = (): Booking[] => {
  const stored = localStorage.getItem(LOCAL_BOOKINGS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

const saveLocalBookings = (bookings: Booking[]) => {
  localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(bookings));
  window.dispatchEvent(new CustomEvent('supabase-realtime-booking', { detail: bookings }));
};
