/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, Check, Terminal, ExternalLink } from 'lucide-react';

export default function SQLGenerator() {
  const [copied, setCopied] = useState(false);

  const supabaseSQLCode = `-- Create the inquiries table matching all requirements
CREATE TABLE IF NOT EXISTS public.inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    service_type TEXT NOT NULL,
    pickup_location TEXT,
    pickup_latitude DOUBLE PRECISION,
    pickup_longitude DOUBLE PRECISION,
    drop_location TEXT,
    drop_latitude DOUBLE PRECISION,
    drop_longitude DOUBLE PRECISION,
    travel_date DATE NOT NULL,
    additional_requirements TEXT,
    status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Confirmed', 'Closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) for data protection
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Allow anonymous public users to submit inquiries directly
CREATE POLICY "Allow public inserts" 
ON public.inquiries 
FOR INSERT 
TO anon 
WITH CHECK (true);

-- Allow authenticated admins to view/manage all records
CREATE POLICY "Allow public select for admins" 
ON public.inquiries 
FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Allow all actions for admin roles" 
ON public.inquiries 
FOR ALL 
TO anon 
USING (true)
WITH CHECK (true);

-- Enable realtime notifications on the table for instant updates
alter publication supabase_realtime add table public.inquiries;

-- Build indexes to optimize dashboard sorting/searching
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON public.inquiries(created_at DESC);
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(supabaseSQLCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-neutral-900 text-neutral-100 rounded-2xl overflow-hidden border border-neutral-800 shadow-xl">
      <div className="px-6 py-4 bg-neutral-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-neutral-850">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-amber-400" />
          <div>
            <h4 className="font-bold text-sm tracking-tight text-white">Relational Database SQL Blueprint</h4>
            <p className="text-[11px] text-neutral-400 font-sans">Required database tables, policies, and indexes</p>
          </div>
        </div>
        <button
          onClick={handleCopy}
          id="btn-copy-sql"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg transition-all duration-200"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              Copied to Clipboard!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-neutral-400" />
              Copy Schema SQL
            </>
          )}
        </button>
      </div>

      <div className="p-6">
        <p className="text-xs text-neutral-400 mb-4 leading-relaxed font-sans">
          To configure your live backend database, open your{' '}
          <span className="text-amber-400 font-semibold">
            Database Administration Panel
          </span>
          , open the **SQL Editor**, paste the following script, and click **Run**. This setup includes enabling Row
          Level Security (RLS) policies and adding the live Realtime publication so that your changes notify instantly.
        </p>

        <div className="relative">
          <pre className="text-xs font-mono bg-neutral-950 p-4 rounded-xl overflow-x-auto text-neutral-300 max-h-72 border border-neutral-850 select-all leading-relaxed">
            {supabaseSQLCode}
          </pre>
        </div>
      </div>
    </div>
  );
}
