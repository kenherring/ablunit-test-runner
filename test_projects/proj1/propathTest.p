define variable bl as OpenEdge.Web.WebResponse no-undo.

message "PROPATH=" + replace(PROPATH,',','~n - ').

@Test.
procedure testConstructor :
    bl = new OpenEdge.Web.WebResponse().
end procedure.
