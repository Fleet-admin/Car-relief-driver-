/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Inquiry, InquiryStatus, ServiceType } from '../types';

// Read configuration from environment variables or local storage overrides
const getSupabaseConfig = () => {
  const metaEnv = (import.meta as any).env || {};
  const envUrl = metaEnv.VITE_SUPABASE_URL || '';
  const envKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';
  
  // Also check standard Next.js-like environment variables as specified in the environment prompt!
  const nextUrl = metaEnv.VITE_NEXT_PUBLIC_SUPABASE_URL || '';
  const nextKey = metaEnv.VITE_NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const finalUrl = envUrl || nextUrl || localStorage.getItem('override_supabase_url') || '';
  const finalKey = envKey || nextKey || localStorage.getItem('override_supabase_anon_key') || '';

  return {
    url: finalUrl.trim(),
    anonKey: finalKey.trim(),
    isConfigured: finalUrl.trim().length > 0 && finalKey.trim().length > 0,
  };
};

export const config = getSupabaseConfig();

let supabaseClient: SupabaseClient | null = null;
if (config.isConfigured) {
  try {
    supabaseClient = createClient(config.url, config.anonKey);
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
  }
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

  setOverrideCredentials(url: string, anonKey: string) {
    localStorage.setItem('override_supabase_url', url);
    localStorage.setItem('override_supabase_anon_key', anonKey);
    window.location.reload();
  },

  clearOverrideCredentials() {
    localStorage.removeItem('override_supabase_url');
    localStorage.removeItem('override_supabase_anon_key');
    window.location.reload();
  },

  async queryInquiries(): Promise<Inquiry[]> {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('inquiries')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []) as Inquiry[];
      } catch (err) {
        console.error('Supabase fetch failed, holding back to local records:', err);
        return getLocalInquiries();
      }
    }
    return getLocalInquiries();
  },

  async insertInquiry(inquiryData: Omit<Inquiry, 'id' | 'created_at' | 'status'>): Promise<Inquiry> {
    const newInquiry: Inquiry = {
      ...inquiryData,
      id: crypto.randomUUID(),
      status: 'New',
      created_at: new Date().toISOString(),
    };

    if (supabaseClient) {
      try {
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
            }
          ])
          .select();

        if (error) throw error;
        if (data && data[0]) {
          return data[0] as Inquiry;
        }
      } catch (err) {
        console.error('Supabase write failed, falling back to local simulation:', err);
      }
    }

    // fallback simulation
    const currentList = getLocalInquiries();
    const updated = [newInquiry, ...currentList];
    saveLocalInquiries(updated);
    return newInquiry;
  },

  async updateStatus(id: string, status: InquiryStatus): Promise<boolean> {
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('inquiries')
          .update({ status })
          .eq('id', id);

        if (error) throw error;
        return true;
      } catch (err) {
        console.error('Supabase update status failed:', err);
      }
    }

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
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('from')
          .delete()
          .eq('id', id);
        // Note: checking table delete
        const { error: err2 } = await supabaseClient.from('inquiries').delete().eq('id', id);
        if (err2) throw err2;
        return true;
      } catch (err) {
        console.error('Supabase delete failed:', err);
      }
    }

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
};
