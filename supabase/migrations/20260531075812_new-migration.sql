-- ============================================================
-- STEP 1: Drop ALL existing policies
-- ============================================================

-- profiles
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "Profiles viewable by owner or admin" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "users can read own profile" ON profiles;
DROP POLICY IF EXISTS "users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;

-- bookings
DROP POLICY IF EXISTS "Admin can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Admins delete bookings" ON bookings;
DROP POLICY IF EXISTS "Owner can read own hotel bookings" ON bookings;
DROP POLICY IF EXISTS "Owner can update own hotel bookings" ON bookings;
DROP POLICY IF EXISTS "Owner can view bookings for their hotel" ON bookings;
DROP POLICY IF EXISTS "Owners can update bookings for their hotel (e.g. status)" ON bookings;
DROP POLICY IF EXISTS "Owners can view bookings for their hotel" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;
DROP POLICY IF EXISTS "Users create own bookings" ON bookings;
DROP POLICY IF EXISTS "Users update own bookings" ON bookings;
DROP POLICY IF EXISTS "Users view own bookings" ON bookings;

-- hotels
DROP POLICY IF EXISTS "Admin can delete hotels" ON hotels;
DROP POLICY IF EXISTS "Admin can insert hotels" ON hotels;
DROP POLICY IF EXISTS "Admins manage hotels" ON hotels;
DROP POLICY IF EXISTS "Anyone can view hotels" ON hotels;
DROP POLICY IF EXISTS "Hotels public read" ON hotels;
DROP POLICY IF EXISTS "Owner can update own hotel" ON hotels;
DROP POLICY IF EXISTS "Owner can update their hotel" ON hotels;
DROP POLICY IF EXISTS "Owners can update their own hotel" ON hotels;
DROP POLICY IF EXISTS "Public can read hotels" ON hotels;

-- rooms
DROP POLICY IF EXISTS "Admin can manage all rooms" ON rooms;
DROP POLICY IF EXISTS "Admins manage rooms" ON rooms;
DROP POLICY IF EXISTS "Anyone can view rooms" ON rooms;
DROP POLICY IF EXISTS "Owner can delete rooms" ON rooms;
DROP POLICY IF EXISTS "Owner can insert rooms" ON rooms;
DROP POLICY IF EXISTS "Owner can manage rooms in their hotel" ON rooms;
DROP POLICY IF EXISTS "Owner can update rooms" ON rooms;
DROP POLICY IF EXISTS "Owners can manage rooms for their hotel" ON rooms;
DROP POLICY IF EXISTS "Public can read rooms" ON rooms;
DROP POLICY IF EXISTS "Rooms public read" ON rooms;

-- payments
DROP POLICY IF EXISTS "Admins manage payments" ON payments;
DROP POLICY IF EXISTS "Owner can view payments for their hotel bookings" ON payments;
DROP POLICY IF EXISTS "Users can insert payments" ON payments;
DROP POLICY IF EXISTS "Users can view their own payments" ON payments;
DROP POLICY IF EXISTS "Users view own payments" ON payments;

-- favorites
DROP POLICY IF EXISTS "Users add favorites" ON favorites;
DROP POLICY IF EXISTS "Users can manage their own favorites" ON favorites;
DROP POLICY IF EXISTS "Users remove favorites" ON favorites;
DROP POLICY IF EXISTS "Users view own favorites" ON favorites;

-- reviews
DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
DROP POLICY IF EXISTS "Authenticated users can write reviews" ON reviews;
DROP POLICY IF EXISTS "Reviews public read" ON reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can insert their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users create own reviews" ON reviews;
DROP POLICY IF EXISTS "Users delete own reviews / admin" ON reviews;
DROP POLICY IF EXISTS "Users update own reviews" ON reviews;

-- hotel_requests
DROP POLICY IF EXISTS "Admin can delete requests" ON hotel_requests;
DROP POLICY IF EXISTS "Admin can read all requests" ON hotel_requests;
DROP POLICY IF EXISTS "Admin can update requests" ON hotel_requests;
DROP POLICY IF EXISTS "Users can insert own request" ON hotel_requests;
DROP POLICY IF EXISTS "Users can insert their own partner requests" ON hotel_requests;
DROP POLICY IF EXISTS "Users can view their own requests" ON hotel_requests;

-- user_roles
DROP POLICY IF EXISTS "Admin can manage all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON user_roles;


-- ============================================================
-- STEP 2: Helper function to check admin (avoids recursion)
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'hotel_owner'
  );
$$;


-- ============================================================
-- STEP 3: Recreate clean policies
-- ============================================================

-- user_roles (no recursion risk — check directly)
CREATE POLICY "users view own role"
  ON user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "admins manage roles"
  ON user_roles FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- profiles
CREATE POLICY "users read own profile"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "users insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "users update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- hotels (public read, owner/admin write)
CREATE POLICY "anyone can view hotels"
  ON hotels FOR SELECT
  USING (true);

CREATE POLICY "owners insert hotels"
  ON hotels FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR is_admin());

CREATE POLICY "owners update hotels"
  ON hotels FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR is_admin());

CREATE POLICY "admins delete hotels"
  ON hotels FOR DELETE TO authenticated
  USING (is_admin());

-- rooms (public read, owner/admin write)
CREATE POLICY "anyone can view rooms"
  ON rooms FOR SELECT
  USING (true);

CREATE POLICY "owners manage rooms"
  ON rooms FOR ALL TO authenticated
  USING (
    is_admin() OR
    EXISTS (SELECT 1 FROM hotels WHERE hotels.id = rooms.hotel_id AND hotels.owner_id = auth.uid())
  )
  WITH CHECK (
    is_admin() OR
    EXISTS (SELECT 1 FROM hotels WHERE hotels.id = rooms.hotel_id AND hotels.owner_id = auth.uid())
  );

-- bookings
CREATE POLICY "users view own bookings"
  ON bookings FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    is_admin() OR
    EXISTS (SELECT 1 FROM hotels WHERE hotels.id = bookings.hotel_id AND hotels.owner_id = auth.uid())
  );

CREATE POLICY "users create bookings"
  ON bookings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users or owners update bookings"
  ON bookings FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() OR
    is_admin() OR
    EXISTS (SELECT 1 FROM hotels WHERE hotels.id = bookings.hotel_id AND hotels.owner_id = auth.uid())
  );

CREATE POLICY "admins delete bookings"
  ON bookings FOR DELETE TO authenticated
  USING (is_admin());

-- payments
CREATE POLICY "users view own payments"
  ON payments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    is_admin() OR
    EXISTS (
      SELECT 1 FROM bookings
      JOIN hotels ON hotels.id = bookings.hotel_id
      WHERE bookings.id = payments.booking_id AND hotels.owner_id = auth.uid()
    )
  );

CREATE POLICY "users insert payments"
  ON payments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins manage payments"
  ON payments FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- favorites
CREATE POLICY "users manage own favorites"
  ON favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- reviews
CREATE POLICY "anyone can view reviews"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "users manage own reviews"
  ON reviews FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid());

-- hotel_requests
CREATE POLICY "users manage own requests"
  ON hotel_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "users insert requests"
  ON hotel_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins manage requests"
  ON hotel_requests FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());