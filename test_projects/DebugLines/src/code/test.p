define stream iStream.
define stream oStream.

input stream iStream from value("out/code/A1.r.codes").
output stream oStream to value("out/code/A1.r.conv").
define variable codes as character no-undo.
define variable code as character no-undo.

define variable cnt as integer no-undo.
import stream iStream unformatted codes.
message "CODES=" + codes.

do cnt = 1 to num-entries(codes," "):
	code = entry(cnt,codes," ").
	message "CODE=" + code.
	cnt = cnt + 1.
	put chr(int(code)).
end.
input stream iStream close.
output stream oStream close.
