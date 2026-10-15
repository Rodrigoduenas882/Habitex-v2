-- RLS policies require table-level privileges before they can be evaluated.
-- Grant only operations for which Habitex already defines authenticated RLS policies.
grant select on public.accounts, public.people, public.administrations, public.administration_members,
 public.properties, public.rooms, public.property_spaces, public.room_space_access, public.parkings,
 public.rental_subjects, public.asset_rights, public.rental_relationships,
 public.rental_relationship_subjects, public.rental_participants, public.rental_term_versions,
 public.files, public.contracts, public.acts, public.act_items, public.act_files, public.act_observations,
 public.acceptances, public.charges, public.payments, public.payment_allocations, public.receipts,
 public.administration_subscriptions, public.communication_events, public.communication_deliveries,
 public.audit_events to authenticated;

grant update on public.people, public.administrations, public.properties, public.rooms, public.property_spaces,
 public.parkings, public.rental_subjects, public.asset_rights, public.rental_relationships,
 public.rental_relationship_subjects, public.rental_participants, public.rental_term_versions,
 public.contracts, public.acts, public.act_items, public.act_files to authenticated;

grant insert on public.properties, public.rooms, public.property_spaces, public.room_space_access,
 public.parkings, public.rental_subjects, public.asset_rights, public.rental_relationships,
 public.rental_relationship_subjects, public.rental_participants, public.rental_term_versions,
 public.files, public.contracts, public.acts, public.act_items, public.act_files, public.act_observations,
 public.secure_actions, public.acceptances to authenticated;

grant delete on public.properties, public.rooms, public.property_spaces, public.room_space_access,
 public.parkings, public.rental_subjects, public.rental_relationship_subjects, public.rental_participants,
 public.rental_term_versions, public.files, public.act_items, public.act_files to authenticated;

-- secure_actions is deliberately not SELECT-able through the client API; managers may create/revoke/update it.
grant update on public.secure_actions to authenticated;

-- Views need explicit SELECT as well; their underlying security behavior remains governed by their definition/RLS model.
grant select on public.charge_balances to authenticated;

-- Prevent accidental future broad exposure from PostgreSQL's PUBLIC defaults.
revoke all on all tables in schema public from anon;
