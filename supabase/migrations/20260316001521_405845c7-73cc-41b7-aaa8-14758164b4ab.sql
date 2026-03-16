
-- 1. Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'assessor');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'assessor',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS on user_roles: users can read their own roles
CREATE POLICY "Users can read own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 5. Only admins can manage roles
CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Auto-assign 'assessor' role on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'assessor');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 7. Fix RLS: documents SELECT open to all authenticated, write restricted to admin
DROP POLICY IF EXISTS "Authenticated users can select documents" ON public.documents;
CREATE POLICY "Authenticated users can select documents" ON public.documents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
CREATE POLICY "Admins can insert documents" ON public.documents FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
CREATE POLICY "Admins can update documents" ON public.documents FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
CREATE POLICY "Admins can delete documents" ON public.documents FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 8. Fix RLS: document_chunks SELECT open, write restricted to admin
DROP POLICY IF EXISTS "Users can select chunks for own documents" ON public.document_chunks;
CREATE POLICY "Authenticated users can select chunks" ON public.document_chunks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert chunks for own documents" ON public.document_chunks;
CREATE POLICY "Admins can insert chunks" ON public.document_chunks FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update chunks for own documents" ON public.document_chunks;
CREATE POLICY "Admins can update chunks" ON public.document_chunks FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete chunks for own documents" ON public.document_chunks;
CREATE POLICY "Admins can delete chunks" ON public.document_chunks FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 9. Fix RLS: daily_navs SELECT open, write restricted to admin
DROP POLICY IF EXISTS "Authenticated users can insert daily_navs" ON public.daily_navs;
CREATE POLICY "Admins can insert daily_navs" ON public.daily_navs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can update daily_navs" ON public.daily_navs;
CREATE POLICY "Admins can update daily_navs" ON public.daily_navs FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can delete daily_navs" ON public.daily_navs;
CREATE POLICY "Admins can delete daily_navs" ON public.daily_navs FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 10. Fix RLS: daily_holdings SELECT open, write restricted to admin
DROP POLICY IF EXISTS "Authenticated users can insert daily_holdings" ON public.daily_holdings;
CREATE POLICY "Admins can insert daily_holdings" ON public.daily_holdings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can update daily_holdings" ON public.daily_holdings;
CREATE POLICY "Admins can update daily_holdings" ON public.daily_holdings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can delete daily_holdings" ON public.daily_holdings;
CREATE POLICY "Admins can delete daily_holdings" ON public.daily_holdings FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 11. Fix RLS: asset_prices SELECT open, write restricted to admin
DROP POLICY IF EXISTS "Authenticated users can insert asset_prices" ON public.asset_prices;
CREATE POLICY "Admins can insert asset_prices" ON public.asset_prices FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can update asset_prices" ON public.asset_prices;
CREATE POLICY "Admins can update asset_prices" ON public.asset_prices FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can delete asset_prices" ON public.asset_prices;
CREATE POLICY "Admins can delete asset_prices" ON public.asset_prices FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
