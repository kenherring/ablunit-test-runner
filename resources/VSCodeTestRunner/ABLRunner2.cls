
BLOCK-LEVEL ON ERROR UNDO, THROW.

using OpenEdge.ABLUnit.Runner.TestConfig.

class VSCodeTestRunner.ABLRunner2 inherits OpenEdge.ABLUnit.Runner.ABLRunner :

    constructor ABLRunner2 (ip1 as TestConfig, ip2 as character):
        super(ip1, ip2).
    end constructor.

end class.
