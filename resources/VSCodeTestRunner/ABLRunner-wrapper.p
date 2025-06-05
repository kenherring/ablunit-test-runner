block-level on error undo, throw.
define input parameter testConfig as OpenEdge.ABLUnit.Runner.TestConfig no-undo.
define input parameter updateFile as character no-undo.
new VSCode.ABLUnit.Runner.ABLRunner(testConfig, updateFile):RunTests().
