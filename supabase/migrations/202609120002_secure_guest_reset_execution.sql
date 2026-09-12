-- The authenticated role intentionally cannot delete audit events directly.
-- This owner-scoped function performs the reset with its definer privileges
-- after reset_guest_demo verifies auth.uid() belongs to a guest profile.
alter function public.reset_guest_demo() security definer;
