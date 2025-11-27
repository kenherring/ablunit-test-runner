message "initialization procedure starting...".
define variable hndl as handle no-undo.
run super_proc.p persistent set hndl.
session:add-super-procedure(hndl).
message "initialization procedure complete!".
