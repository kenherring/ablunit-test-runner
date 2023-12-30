@testsuite(procedures="proc2/proc0.p").
ROUTINE-LEVEL ON ERROR UNDO, THROW.

@TestSuite(classes="login2/doLoginTest.cls").
@TestSuite  (classes  =  "login2.test2,login2.test3"  ).

@testsuite(procedures="proc2/proc1.p,proc2/proc2.p,proc2/proc3.p").
 	   @TESTSUITE 	  (procedures 	  = 	  "proc2/proc4.p" 	 ).
@testsuite(procedures="proc2/proc5.p", classes="login2/test5.cls").
@testsuite(procedures="login2/test6.cls").
