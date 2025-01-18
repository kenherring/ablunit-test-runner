
block-level on error undo, throw.

if true then
    message "first".
else
do:
    message "second".
    message "third".
end.

file-info:file-name = '.'.
message 'file-info:full-pathname=' + file-info:full-pathname.

define variable runpath as character no-undo.
runpath = replace(file-info:full-pathname, '\', '/').
runpath = substring(runpath, 1, r-index(runpath, '/')) + 'externalSource.p'.
message runpath.

run value(runpath).

@Test.
procedure testProcedureName :
  OpenEdge.Core.Assert:Equals(1,1).
  run procedureNotTest.
end procedure.

procedure notRunProc :
  if true then
    message "notRunProc".
end procedure.

procedure procedureNotTest:
  if false then
    message "procedureNotTest".
end procedure.
