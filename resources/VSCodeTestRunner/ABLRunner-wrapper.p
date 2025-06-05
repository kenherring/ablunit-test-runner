define input parameter testConfig as OpenEdge.ABLUnit.Runner.TestConfig no-undo.
define input parameter updateFile as character no-undo.

define variable ablRunner as class VSCode.ABLUnit.Runner.ABLRunner no-undo.
ablRunner = new VSCode.ABLUnit.Runner.ABLRunner(testConfig, updateFile).
ablRunner:RunTests().
