-- Covers the (farm_id, operation_id) foreign key of private.pastures (performance advisor).
create index pastures_farm_operation_idx on private.pastures(farm_id, operation_id);
