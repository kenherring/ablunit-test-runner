// This file replaces the standard ABLUnitCore.p when the basedir is
// included as part of the propath ahead of ablunit.pl.

block-level on error undo, throw.

define variable thisProcDir as character no-undo.
thisProcDir = replace(program-name(1), '~\', '/').
entry(num-entries(thisProcDir, '/'), thisProcDir, '/') = ''.

run value(thisProcDir + "ABLUnitCore_sub.p")(session:parameter).
