
@Test.
procedure NotSkippedTest :
    message 'PROPATH=' + propath.
    message 'ABLUnitCore.p=' + search('ABLUnitCore').
end procedure.

@Test. @Ignore.
procedure SkippedTest :
end procedure.

@Test.
@Ignore.
procedure SkippedTest2 :
end procedure.

@Test.
@Ignore .
procedure SkippedTest3 :
end procedure.

// Not a test case
@Ignore.
procedure SkippedTest4 :
end procedure.

@Ignore  .
@Test.
procedure SkippedTest5 :
end procedure.
