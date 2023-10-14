//include2.i#1
define var somevar as int init 1 no-undo.

somevar = 2.
OpenEdge.Core.Assert:equals(1,somevar).
//include2.i#6