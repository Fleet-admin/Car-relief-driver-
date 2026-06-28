import React, { useState, useEffect } from 'react';
import { GeneralSettings } from '../types';
import { SupabaseService } from '../lib/supabase';
import { 
  Building2, Image as ImageIcon, Phone, Mail, MapPin, 
  Globe, Save, RotateCcw, Loader2, Upload 
} from 'lucide-react';

interface SettingsManagementProps {
  onNotify: (msg: string) => void;
}

export default function SettingsManagement({ onNotify }: SettingsManagementProps) {
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [timeZone, setTimeZone] = useState('UTC+5:30 (India Standard Time)');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await SupabaseService.getSettings();
      setSettings(data);
      
      setCompanyName(data.company_name);
      setCompanyLogo(data.company_logo || '');
      setContactNumber(data.contact_number || '');
      setEmail(data.email_address || '');
      setAddress(data.office_address || '');
      setTimeZone(data.timezone || 'UTC+5:30 (India Standard Time)');
    } catch (err) {
      console.error('Failed to load settings:', err);
      onNotify('Failed to load settings. Using local state configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (settings) {
      setCompanyName(settings.company_name);
      setCompanyLogo(settings.company_logo || '');
      setContactNumber(settings.contact_number || '');
      setEmail(settings.email_address || '');
      setAddress(settings.office_address || '');
      setTimeZone(settings.timezone || 'UTC+5:30 (India Standard Time)');
      onNotify('Form edits reverted.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      onNotify('Company name is a required field.');
      return;
    }

    setSaving(true);
    try {
      const updatedSettings: GeneralSettings = {
        company_name: companyName.trim(),
        company_logo: companyLogo.trim() || null,
        contact_number: contactNumber.trim(),
        email_address: email.trim(),
        office_address: address.trim(),
        timezone: timeZone.trim()
      };

      await SupabaseService.saveSettings(updatedSettings);
      setSettings(updatedSettings);
      onNotify('General Configuration updated successfully.');
    } catch (err) {
      console.error('Failed to save settings:', err);
      onNotify('Failed to update settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center flex flex-col justify-center items-center gap-3 bg-white border border-neutral-200 rounded-3xl shadow-sm">
        <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
        <p className="text-xs text-neutral-500 font-sans">Syncing workspace and brand parameters...</p>
      </div>
    );
  }

  return (
    <div id="settings-management-page" className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-neutral-950 font-sans">General Configuration</h2>
        <p className="text-xs text-neutral-500 font-sans mt-0.5">Customize your brand identity, primary touchpoints, and localization values.</p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-5">
        {/* Company / Fleet Name */}
        <div>
          <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Company / Fleet Name*</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
              <Building2 className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              placeholder="e.g. Royal Travels & Fleet"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 outline-none transition"
            />
          </div>
        </div>

        {/* Company Logo Image Link */}
        <div>
          <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Company Logo Brand Asset (URL or Local Upload)</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <ImageIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Paste company logo public image URL or upload..."
                value={companyLogo}
                onChange={(e) => setCompanyLogo(e.target.value)}
                className="w-full text-xs font-medium pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 outline-none transition"
              />
            </div>
            <label className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-xl text-neutral-700 text-xs font-extrabold font-sans cursor-pointer transition shrink-0 flex items-center gap-2 select-none">
              <Upload className="w-4 h-4" />
              <span>Upload</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const base64 = event.target?.result as string;
                      setCompanyLogo(base64);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="hidden"
              />
            </label>
          </div>
          {companyLogo && (
            <div className="mt-2.5 flex items-center gap-3 bg-neutral-50 border border-neutral-150 p-2.5 rounded-xl max-w-xs">
              <span className="text-[9px] text-neutral-400 uppercase font-bold shrink-0">Logo Preview:</span>
              <img src={companyLogo} alt="Logo preview" referrerPolicy="no-referrer" className="h-6 object-contain" />
              <button 
                type="button" 
                onClick={() => setCompanyLogo('')} 
                className="text-red-500 hover:text-red-700 text-[10px] font-bold ml-auto"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact phone number */}
          <div>
            <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Support Contact Number</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="e.g. +91 98765 43210"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 outline-none transition font-mono"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Corporate Support Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                placeholder="e.g. ops@royalfleet.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Office Address */}
        <div>
          <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">HQ / Office Address</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 pt-3.5 pointer-events-none text-neutral-400">
              <MapPin className="w-4 h-4" />
            </div>
            <textarea
              placeholder="Enter corporate office physical address..."
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full text-xs font-medium pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 outline-none transition resize-none"
            />
          </div>
        </div>

        {/* Time Zone picker */}
        <div>
          <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Operational Time Zone</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
              <Globe className="w-4 h-4" />
            </div>
            <select
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              className="w-full text-xs font-bold pl-10 pr-10 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 outline-none transition appearance-none"
            >
              <option value="UTC+5:30 (India Standard Time)">UTC+5:30 (India Standard Time)</option>
              <option value="UTC+0:00 (Greenwich Mean Time)">UTC+0:00 (Greenwich Mean Time)</option>
              <option value="UTC-5:00 (Eastern Standard Time)">UTC-5:00 (Eastern Standard Time)</option>
              <option value="UTC+8:00 (Singapore / China Standard Time)">UTC+8:00 (Singapore / China Standard Time)</option>
              <option value="UTC-8:00 (Pacific Standard Time)">UTC-8:00 (Pacific Standard Time)</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-neutral-400">
              <span className="text-[10px]">▼</span>
            </div>
          </div>
        </div>

        {/* Form controls button footer */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-5">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2.5 border border-neutral-250 text-neutral-700 hover:bg-neutral-50 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Revert
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-amber-400" />}
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
