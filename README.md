# HimalStay 🏔️

A production-ready, full-stack hotel booking and management SaaS tailored specifically for the Nepalese tourism industry. HimalStay seamlessly connects travelers with local properties, featuring localized payments (Khalti), an AI-powered booking concierge (NVIDIA NIM), and a comprehensive dashboard for hotel owners to manage their businesses.

---

## 📖 Table of Contents
1. [Key Features](#-key-features)
2. [Tech Stack & Languages](#-tech-stack--languages)
3. [Full Setup & Installation Guide](#-full-setup--installation-guide)
4. [Environment Variables Guide](#-environment-variables-guide)
5. [Supabase Database Setup (SQL)](#-supabase-database-setup-sql)
6. [Author](#-author)

---

## 🚀 Key Features

### 🧑‍💻 Multi-Tenant Role-Based Architecture
* **Guest Portal (Customer):** Dynamic search, real-time availability engine, favorites management, and verified reviews carousel.
* **Hotel Owner Dashboard:** Real-time revenue analytics, property management, and drag-and-drop cloud image uploads.
* **Admin Control Panel:** Global overview with interactive charts (Recharts) tracking revenue, user roles, and featured hotels.

### 💳 Localized Booking & Payments
* **Khalti Integration:** Secure, instant online payment processing via the Khalti Sandbox.
* **Smart Currency:** Dynamic pricing breakdowns displaying both USD and live NPR (Nepalese Rupee) equivalents.

### 🤖 AI Booking Concierge
* **Context-Aware Assistant:** Powered by NVIDIA NIM API.
* **Live Inventory Retrieval:** The AI dynamically reads public hotel data to recommend actual, available stays.
* **Privacy-First:** Strict system prompt guardrails ensure no user PII or private booking data is ever exposed to the LLM.

---

## 💻 Tech Stack & Languages

* **Frontend:** React 18, TypeScript, TanStack Router (SPA mode), Tailwind CSS, shadcn/ui, Recharts.
* **Backend & Database:** Supabase (PostgreSQL, Authentication, Storage Buckets).
* **AI & Emails:** NVIDIA NIM API, Mailjet API.

---

## ⚙️ Full Setup & Installation Guide

### 1. Clone the Repository
```bash
git clone [https://github.com/nischalsir/HimalStay---Modern-Hospitality-Management-Platform.git]( https://github.com/nischalsir/HimalStay---Modern-Hospitality-Management-Platform.git)
cd himalstay

### 2. Install Dependencies
```
```bash
npm install

```

### 3. Setup Environment Variables

Create a file named `.env` in the root of your project. Copy the template below and fill in your keys (see the guide below on how to get them):

```env
# Supabase Configuration
VITE_SUPABASE_URL="your_supabase_url_here"
VITE_SUPABASE_ANON_KEY="your_supabase_anon_key_here"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key_here"

# Payment Gateway (Khalti)
KHALTI_SECRET_KEY="your_khalti_secret_key_here"

# AI Configuration (NVIDIA NIM)
NVIDIA_API_KEY="your_nvidia_api_key_here"

# Mailjet Email Configuration
MAILJET_API_KEY="your_mailjet_api_key_here"
MAILJET_SECRET_KEY="your_mailjet_secret_key_here"
MAILJET_SENDER_EMAIL="your_verified_sender_email@gmail.com"

```

### 4. Setup the Database

Go to your Supabase project, navigate to the **SQL Editor**, and paste the Master SQL Script provided in the [Supabase Database Setup](https://www.google.com/search?q=%23-supabase-database-setup-sql) section below. Run it once to create all tables, buckets, and security policies.

### 5. Start the Development Server

```bash
npm run dev

```

The application will start at `http://localhost:5173`.

---

## 🔑 Environment Variables Guide

Here is how to get the required keys for your `.env` file:

1. **Supabase Keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`):**
* Go to your [Supabase Dashboard](https://www.google.com/search?q=https://supabase.com/dashboard).
* Click the **Settings** gear icon (bottom left) -> **API**.
* Copy the Project URL, the `anon` `public` key, and the `service_role` `secret` key.


2. **Khalti Key (`KHALTI_SECRET_KEY`):**
* Log into your [Khalti Merchant Dashboard](https://www.google.com/search?q=https://admin.khalti.com/).
* Switch to **Test Mode** (Sandbox).
* Go to **Keys** and copy the Secret Key.


3. **NVIDIA Key (`NVIDIA_API_KEY`):**
* Go to [build.nvidia.com](https://www.google.com/search?q=https://build.nvidia.com/).
* Select a model (e.g., Llama 3) -> Click **Get API Key** -> Generate and copy the key (starts with `nvapi-`).


4. **Mailjet Keys (`MAILJET_API_KEY`, `MAILJET_SECRET_KEY`):**
* Go to your [Mailjet Dashboard](https://www.google.com/search?q=https://app.mailjet.com/).
* Navigate to **Account Settings** -> **REST API Keys**.
* Ensure your `MAILJET_SENDER_EMAIL` is verified in the Mailjet sender domains list.



---

## 🗄️ Supabase Database Setup (SQL)

Copy this entire block of SQL, paste it into your **Supabase SQL Editor**, and click **Run**. This will instantly set up your tables, storage buckets, and secure RLS policies.

```sql
-- ==========================================
-- 1. ENABLE EXTENSIONS & SET ROLE
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SET ROLE postgres;

-- ==========================================
-- 2. CREATE TABLES
-- ==========================================

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    role TEXT CHECK (role IN ('admin', 'hotel_owner', 'customer')) DEFAULT 'customer',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hotels
CREATE TABLE IF NOT EXISTS public.hotels (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    city TEXT,
    country TEXT DEFAULT 'Nepal',
    address TEXT,
    description TEXT,
    cover_image TEXT,
    price_from DECIMAL(10,2) DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    star_rating INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    capacity INTEGER DEFAULT 2,
    price_per_night DECIMAL(10,2) NOT NULL,
    images TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    guest_name TEXT,
    guest_email TEXT,
    guest_phone TEXT,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    guests INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    payment_status TEXT DEFAULT 'pending',
    subtotal DECIMAL(10,2),
    tax_amount DECIMAL(10,2),
    service_charge DECIMAL(10,2),
    total_price DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    exchange_rate_at_booking DECIMAL(10,2),
    special_requests TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Favorites
CREATE TABLE IF NOT EXISTS public.favorites (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, hotel_id)
);

-- ==========================================
-- 3. CREATE STORAGE BUCKET
-- ==========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hotel_images', 
  'hotel_images', 
  true, 
  5242880, 
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
) ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 4. SECURITY HELPERS & RLS
-- ==========================================

-- Helper function to prevent RLS infinite loops
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Profiles: Public Read, User Update
CREATE POLICY "Public can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Roles: User Read, Admin Manage
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can manage all roles" ON public.user_roles FOR ALL USING (public.is_admin());

-- Hotels: Public Read, Owner Update
CREATE POLICY "Anyone can view hotels" ON public.hotels FOR SELECT USING (true);
CREATE POLICY "Owner can update their hotel" ON public.hotels FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Admin can insert hotels" ON public.hotels FOR INSERT WITH CHECK (public.is_admin());

-- Rooms: Public Read, Owner Manage
CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Owner can manage rooms" ON public.rooms FOR ALL USING (
  EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = rooms.hotel_id AND h.owner_id = auth.uid())
);

-- Bookings: User Manage Own, Owner View/Update Hotel Bookings
CREATE POLICY "Users can view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can view hotel bookings" ON public.bookings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = bookings.hotel_id AND h.owner_id = auth.uid())
);
CREATE POLICY "Owner can update hotel bookings" ON public.bookings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = bookings.hotel_id AND h.owner_id = auth.uid())
);

-- Reviews: Public Read, User Manage Own
CREATE POLICY "Public can view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users can write reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Favorites: User Manage Own
CREATE POLICY "Users can manage own favorites" ON public.favorites FOR ALL USING (auth.uid() = user_id);

-- Storage: Public Read, Owner/Admin Upload
CREATE POLICY "Public view images" ON storage.objects FOR SELECT USING (bucket_id = 'hotel_images');
CREATE POLICY "Owner admin upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'hotel_images' AND auth.role() = 'authenticated' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'hotel_owner'))
);

-- Reset Role
RESET ROLE;

```

---

## 👨‍💻 Author

**Nischal Pandey**
* GitHub: [@nischalsir](https://www.google.com/search?q=https://github.com/nischalsir)

```

```
