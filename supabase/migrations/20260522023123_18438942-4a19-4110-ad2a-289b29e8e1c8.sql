
CREATE OR REPLACE FUNCTION public.recalc_hotel_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_hotel uuid;
  new_avg numeric;
BEGIN
  target_hotel := COALESCE(NEW.hotel_id, OLD.hotel_id);
  SELECT COALESCE(AVG(rating), 0) INTO new_avg
  FROM public.reviews WHERE hotel_id = target_hotel;
  UPDATE public.hotels SET rating = ROUND(new_avg::numeric, 2) WHERE id = target_hotel;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reviews_recalc_rating ON public.reviews;
CREATE TRIGGER reviews_recalc_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.recalc_hotel_rating();

-- Backfill existing
UPDATE public.hotels h SET rating = COALESCE((
  SELECT ROUND(AVG(r.rating)::numeric, 2) FROM public.reviews r WHERE r.hotel_id = h.id
), 0);

-- Allow admins to view all profiles (for booking management)
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
