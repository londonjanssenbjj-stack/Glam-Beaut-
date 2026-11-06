-- Permitir que cada usuário crie somente o próprio papel básico de cliente.
-- Papéis privilegiados continuam provisionados exclusivamente pelo backend/administrador.
drop policy if exists "Users can create own customer role" on public.user_roles;
create policy "Users can create own customer role"
on public.user_roles for insert to authenticated
with check ((select auth.uid()) = user_id and role = 'customer');
grant insert on public.user_roles to authenticated;
