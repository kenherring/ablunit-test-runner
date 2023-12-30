define variable codes as character no-undo.

codes = "0,0,0,116,101,115,116,70,117,110,99,87,105,116,104,73,110,99,108,117,100,101,0,0,0,0,0,45,0,0,0,47,0,0,0,49,0,0,0,50,0,0,0,51,0,0,0,0,0,0,0,72,1,0,0,224,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,216,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,5,0,0,0,101,110,100,70,117,110,99,0,56,0,0,0,57,0,0,0,168,1,0,0,24,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,0,0,0,0,0,5,0,2,0,0,0,21,0,0,0,23,0,0,0,27,0,0,0,34,0,0,0,36,0,0,0,38,0,0,0,53,0,0,0,0,0,0,0,229,53,4".

//define variable r as raw no-undo.

define stream oStream.
output stream oStream to value("putfile.txt").

put stream oStream control replace(codes,',',' ').
put stream oStream skip.
put stream oStream ' ----- ' skip.
put stream oStream skip.

define variable cnt as integer no-undo.
define variable cd as int no-undo.
do cnt = 1 to num-entries(codes):
	cd = integer(entry(cnt,codes)).
	message 100 cnt cd chr(cd).

	//raw = raw byte(cd).

	put stream oStream control chr(cd).
end.

output stream oStream close.

message "DONE".
