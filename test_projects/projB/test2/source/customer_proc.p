message "getting customerCount...".
define variable customerCount as integer no-undo.
run get_customer_count.p(output customerCount).
message "customerCount=" + string(customerCount).
