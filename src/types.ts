/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type InquiryStatus = 'New' | 'Contacted' | 'Confirmed' | 'Active' | 'Completed' | 'Cancelled' | 'Closed';

export type ServiceType =
  | 'Fleet Booking'
  | 'Driver Relief'
  | 'Driver Relief Services'
  | 'Outstation Trip'
  | 'Wedding Booking'
  | 'Wedding Plan'
  | 'Premium Logistics Temporary'
  | 'Custom Requirement';

export interface Inquiry {
  id: string;
  name: string;
  phone: string;
  service_type: ServiceType;
  pickup_location: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  drop_location: string | null;
  drop_latitude: number | null;
  drop_longitude: number | null;
  travel_date: string;
  additional_requirements: string | null;
  status: InquiryStatus;
  created_at: string;
  vehicle_category?: string | null;
  
  // New driver and trip tracking columns
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle_number?: string | null;
  driver_id?: string | null;
  vehicle_id?: string | null;
  driver_token?: string | null;
  tracking_token?: string | null;
  trip_started_at?: string | null;
  trip_completed_at?: string | null;
  driver_latitude?: number | null;
  driver_longitude?: number | null;
  driver_message_sent?: boolean | null;
  customer_message_sent?: boolean | null;
  last_location_update?: string | null;
  trip_status?: 'confirmed' | 'driver_en_route' | 'driver_arrived' | 'trip_in_progress' | 'completed' | 'en_route_pickup' | 'arrived_pickup' | 'trip_started' | 'trip_completed' | null;
}

export interface VehicleCategory {
  id?: string;
  name: string;
  base_fare: number;
  per_km_rate: number;
  minimum_fare: number;
  active: boolean;
  status?: 'Available' | 'Under Maintenance' | 'Archived';
  image_url?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  passenger_capacity?: number;
  luggage_capacity?: number;
}

export interface DashboardMetrics {
  total: number;
  new: number;
  confirmed: number;
  active: number;
  completed: number;
  cancelled: number;
}

export interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  pickup_location: string;
  destination_location: string;
  booking_date: string;
  booking_time: string;
  status: 'Pending' | 'Confirmed' | 'Active' | 'Completed';
  trip_status?: 'confirmed' | 'driver_en_route' | 'driver_arrived' | 'trip_in_progress' | 'completed' | 'en_route_pickup' | 'arrived_pickup' | 'trip_started' | 'trip_completed';
  last_location_update?: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_number: string | null;
  driver_id?: string | null;
  vehicle_id?: string | null;
  driver_token: string | null;
  tracking_token: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_latitude: number | null;
  last_longitude: number | null;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  drop_latitude?: number | null;
  drop_longitude?: number | null;
  created_at: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  photo?: string | null;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  vehicle_number: string;
  category_id: string; // References VehicleCategory id or name
  vehicle_model?: string | null;
  photo?: string | null;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
}

export interface GeneralSettings {
  company_name: string;
  company_logo?: string | null;
  contact_number: string;
  email_address: string;
  office_address: string;
  timezone: string;
}
