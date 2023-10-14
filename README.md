# ABLUnit Test Provider

This VSCode test provider extension integrates [ABLUnit tests](https://docs.progress.com/bundle/openedge-developer-studio-help-122/page/Learn-About-ABLUnit-Test-Framework.html) into the VSCode test explorer.

This is my first VSCode extension, and my first TypeScript project. I'm sure there are many ways to improve the code, and I welcome any feedback.  I'm also open to collaboration if anyone is interested.

Quality code, and thus unit testing, is a passion of mine.  I hope this extension helps others to embrace [TDD](https://en.wikipedia.org/wiki/Test-driven_development) and improve their code.

## Extension

### Features

* Run ABLUnit Tests
* See test results
* View code coverage

	![Alt text](docs/coverage.png)

## Contributing

### Running the Project

- Run `npm install` in terminal to install dependencies
- Run the `Run Extension` target in the Debug View. This will:
	- Start a task `npm: watch` to compile the code
	- Run the extension in a new VS Code window
- Run a test in the new VS Code window

## Links

* [Progress Documentation -> Progress Developer Studio for OpenEdge Online Help -> Run test cases from the command prompt](https://docs.progress.com/bundle/openedge-developer-studio-help/page/Run-test-cases-from-the-command-prompt.html)
* [Progress Documentation -> ABLUnit Annotations](// https://docs.progress.com/bundle/openedge-developer-studio-olh-117/page/Annotations-supported-with-ABLUnit.html) - Used w/ snippets
* [GitHub progress/ade](https://github.com/progress/ADE) - source files for OE code
