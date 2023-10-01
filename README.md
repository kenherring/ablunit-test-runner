# ABLUnit Test Provider

This VSCode test provider extension integrates [ABLUnit tests](https://docs.progress.com/bundle/openedge-developer-studio-help-122/page/Learn-About-ABLUnit-Test-Framework.html) into the VSCode test explorer.

## Prerequisites

- Run `winget install nodejs`

## Running the Project

- Run `npm install` in terminal to install dependencies
- Run the `Run Extension` target in the Debug View. This will:
	- Start a task `npm: watch` to compile the code
	- Run the extension in a new VS Code window
- Create a `test.cls` file containing the given content
