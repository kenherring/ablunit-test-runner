### TBD

```jsonc
	/********************************************************************************************
		* The remaining fields can be modified to specify custom methods to execute tests.
		*
		* Caution is advised when modifying these fields.  Most projects would be best served by
		* reducing project complexity to allow for the extension to function with the default values.
		*
		* A few examples of when you might want to modify these fields:
		*
		*   * The project already has configuration to run tests, such as an ant command.
		*     Example:
		*
		*   * The project relies on a custom wrapper to execute progress code.
		*     Example:
		*       "cliCommand": "progBatchWrapper.exe -p ABLUnitCore.p -param \"CFG=${ablunit.json}\"'
		*
		*   * You have already configured a VSCode task to execute tests.
		*     Example:
		*       "${task:vscodeTaskName}"
		*
		*   * There is another VSCode extension that is responsible for executing tests.
		*     Example:
		*       "${command:vscodeCommand}"
		*
		*   NOTE:
		*     When any of the following configuration is used this extension will output
		* 	   the 'ablunit.json' configuration file to the temp directory so that the testing
		*     process has access to read it.
		*
		************************************************************************************************/


	////# The "cliCommand" field is used to specify a custom command to run.
	////# When a value is provided in this field...
	////#
	////# Additional substitution values accepted:
	////#   * ${testlist} will be replace with a comma separated list of test paths to run.
	////#   * ${ablunit.json} will be replaced with the absolute path to the ablunit.json config file.
	////#     - Read more:
	////#
	////#   * The command must access the tests to be executed by either:
	////#      * Leveraging the generated 'ablunit.json' file
	////#      * Accept a comma delimited list of test files from replacement value "${testlist}"
	////#
	////# Examples:
	////#   - "customRunCommand": "ant -f build.xml run-tests -Dtestlist='${testlist}'"
	////#   - "customRunCommand": "prowin32 -p customRunner.p -param '${testfiles}'"
	////#   - "customRunCommand": "${task:My Custom Test Tesk}" - VSCode task, see .vscode/tasks.json
	////#   - "customRunCommand": "${command:<command-name>}" - VSCode command, see package.json

	////# The "runTask" field is used to specify a VSCode task to run tests with.
	////# Accepted values:
	////#   * The name of a task defined in .vscode/tasks.json (or other tasks file)
	////#   * The name of a vscode command.  This is useful if there is another
	////#      extension is responsible for executing tests.
```
