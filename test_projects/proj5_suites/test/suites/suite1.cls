@testsuite(procedures="procs/proc0.p").
ROUTINE-LEVEL ON ERROR UNDO, THROW.

@TestSuite(classes="login/doLoginTest.cls").
@TestSuite  (classes  =  "login.test2,login.test3"  ).

@testsuite(procedures="procs/proc1.p,procs/proc2.p,procs/proc3.p").
 	   @TESTSUITE 	  (procedures 	  = 	  "procs/proc4.p" 	 ).
@testsuite(procedures="procs/proc5.p", classes="login/test5.cls").
@testsuite(procedures="login/test6.cls").

//@testsuite( procedures="procs/proc99.p").
//@testsuite(procedures="procs/proc99.p") .
//@testsuite(procedures="login.test99").

//NOTES:
// 1. Spaces after the opening '(' and before the classes/procedures keyword fail to compile.
//    * @testsuite( procedures="procs/proc99.p").
//      fails with: "@TestSuite annotation attribute name should be 'classes' or 'procedures'"
// 2. Spaces after the closing ')' and before the '.' fail to run.
//    * @testsuite(procedures="procs/proc99.p") .
//	    runs successfully, but does not run this procedure.
// 3. Adding procedures as classes does not work.
//   * @testsuite(procedures="login.test99").
//     runs successfully, but does not run this class.
//   * The reverse works ... adding .cls files as procedures is OK when using a path.

class suites.suite1:
end class.
