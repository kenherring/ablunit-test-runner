define output parameter cnt as integer no-undo.
for each customer no-lock:
    cnt = cnt + 1.
end.
