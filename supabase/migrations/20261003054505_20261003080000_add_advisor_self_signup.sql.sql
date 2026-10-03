/*
# Add secure Advisor self-signup

1. New Function
- `register_advisor`: creates an advisor profile for the currently authenticated account after signup.

2. Security
- The function derives the account from `auth.uid()` and never accepts a user ID from the browser.
- It only creates an advisor profile when the account has no existing staff profile.
- Only authenticated users can call it.
*/

CREATE OR REPLACE FUNCTION public.register_advisor(p_full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_full_name IS NULL OR length(trim(p_full_name)) < 2 OR length(trim(p_full_name)) > 120 THEN
    RAISE EXCEPTION 'Invalid name';
  END IF;
  IF EXISTS (SELECT 1 FROM public.staff_profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Account already registered';
  END IF;
  INSERT INTO public.staff_profiles (user_id, full_name, role, active)
  VALUES (auth.uid(), trim(p_full_name), 'advisor', true);
END;
$$;

REVOKE ALL ON FUNCTION public.register_advisor(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_advisor(text) TO authenticated;
