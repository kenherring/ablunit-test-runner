block-level on error undo, throw.

message "starting procThrowsException".


procedure proc_that_throws :
  def var cnt as int no-undo.
  do cnt = 1 to 10:
    log-manager:write-message("cnt = " + string(cnt)).
  end.

  message "proc didn't throw exception".
end procedure.

run proc_that_throws.
