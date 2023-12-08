# ABLUnit Test Runner [![CircleCI](https://img.shields.io/circleci/build/github/kenherring/ablunit-test-provider/main?logo=circleci)](https://dl.circleci.com/status-badge/redirect/gh/kenherring/ablunit-test-provider/tree/main) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=kenherring_ablunit-test-provider&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=kenherring_ablunit-test-provider) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=kenherring_ablunit-test-provider&metric=coverage)](https://sonarcloud.io/summary/new_code?id=kenherring_ablunit-test-provider)

The [ABLUnit Test Runner](https://github.com/kenherring/ablunit-test-provider/) VSCode extension integrates [ABLUnit tests](https://docs.progress.com/bundle/openedge-developer-studio-help-122/page/Learn-About-ABLUnit-Test-Framework.html) into the VSCode test explorer.

This is my first VSCode extension, and my first TypeScript project. I'm sure there are many ways to improve the code, and I welcome any feedback.  I'm also open to collaboration for anyone who might wish to contribute.

Quality code, and thus unit testing, is my passion  I hope this extension helps others to embrace [TDD](https://en.wikipedia.org/wiki/Test-driven_development) and improve their code.

## OpenEdge Versions Note

This project was developed using the [Progress OpenEdge Developers Kit: Classroom Edition](https://www.progress.com/openedge/classroom-edition).  That means it's only been tested against version 12.2 at the moment.  Feel free to report any bugs you may run into with other versions.

## Extension

### Features

* Run ABLUnit Tests
* See test results in VSCode Test Explorer
* View code coverage highlighting in the editor

#### Code Coverage Example Screenshot

![code coverage example screenshot](https://github.com/kenherring/ablunit-test-provider/raw/main/docs/coverage.png)

## Configuration

The configuration is broken into two sections.

1.  The first section shows configuration options that users are most likely to change.
2.  Additional configuration options available that are not likely to be change by most users.

### Configuration - Sample Config

This config searches the `test/` directory for test files, named `*Test.cls` or `*Test.p`.  It also passes a database connection to `_progres` via the `-pf` parameter.

**`.vscode/settings.json`**:

```json
{
  "ablunit.files.include": [
    "test/**/*Test.{cls,p}"
  ],
  "ablunit.params": "-pf path/to/dbconnections.pf"
}
```

### Configuration - Most Commonly Changed

| Setting | Default | Description |
| --- | --- | --- |
| `ablunit.params` | | Additional options/parameters passed to `_progres`.  This is most useful for providing database connections. Example: `-pf path/to/dbconnections.pf` |
| `ablunit.files.include` | `[ "**/*.{cls,p}" ]` | Glob pattern array to include test files |
| `ablunit.files.exclude` | `[ "**/.builder/**" ]` | Glob pattern array to exclude test files |
| `ablunit.findAllFilesAtStartup` | `true` | Search all workspace files for test cases.  It may be beneficial to disable this for large workspaces, in which case the extension will find tests as files are accessed. |
| `ablunit.notificationsEnabled` | `true` | Enable/disable notifications |
| `ablunit.tempDir` | Extension storage area | Any files generated when running ABLUnit will be stored here.  It is also used for the [`-T`](https://docs.progress.com/bundle/openedge-startup-and-parameter-reference-122/page/Temporary-Directory-T.html) startup parameter |

<!-- START CONFIGURATION PROPERTIES -->
## Configuration Properties

| Property | Default | Description |
| --- | --- | --- |
| `ablunit.configJson.configPath` | `ablunit.json` | Location of configutation passed to the command line.<br><br>**Example usage\:** \`-param=\\"CFG=ablunit.json\\"\` |
| `ablunit.configJson.outputLocation` |  | Directory where the results file will be written.<br><br>* The filename will always be \`results.xml\`<br>* If the directory does not exist, it will be created<br>* Path can be absolute or relative to the workspace root |
| `ablunit.configJson.outputWriteJson` | `false` | Write the results to \`results.json\` in the same directory as \`results.xml\`. |
| `ablunit.configJson.quitOnEnd` | `true` | Quit the session when the test run is complete<br><br>See [\`Run-test-cases-from-the-command-prompt\`](https\://docs.progress.com/bundle/openedge-developer-studio-help/page/Run-test-cases-from-the-command-prompt.html) for more information. |
| `ablunit.configJson.showErrorMessage` | `true` | If \`showErrorMessage\` is set to true then the error messages is displayed in a new window |
| `ablunit.configJson.throwError` | `false` | If ABLUnit is used as a library inside another program, set \`throwError\` to true, the framework displays the errors occurred |
| `ablunit.configJson.writeLog` | `true` | If \`writeLog\` is true then a log file, \`ablunit.log\` is created in the current working directory and writes error messages to that log file |
| `ablunit.debugEnabled` | `false` | Enable debug level logging for the extension |
| `ablunit.display.classlabel` | `classname` | The label to display for test classes. Example for class with path \`com/example/myClass.cls\`\:<br><br>* class-type-name example\: \`com.example.myClass\`<br>* filename example\: \`myClass.cls\` |
| `ablunit.files.exclude` | `[  "**/.builder/**" ]` | Glob patterns to exclude test files |
| `ablunit.files.include` | `[  "**/*.{cls,p}" ]` | Glob patterns to include test files |
| `ablunit.findAllFilesAtStartup` | `true` | For large workspaces this may improve performance by loading tests as they are found instead of doing so when the extension is activated |
| `ablunit.importOpenedgeProjectJson` | `true` | Import configuration settings from \`openedge-project.json\` when possible |
| `ablunit.notificationsEnabled` | `true` | Show notifications when tests are run |
| `ablunit.params` |  | Additional parameters to pass to the ABLUnit command line<br><br>**Example**\: \`-pf dbconns.pf\` |
| `ablunit.profilerOptions.description` | `Unit Tests Run via ABLUnit Test Runner (VSCode)` | Description assigned to the profiler output<br><br>See the [\`PROFILER\:DESCRIPTION\`](https\://docs.progress.com/bundle/abl-reference/page/DESCRIPTION-attribute.html) attribute |
| `ablunit.profilerOptions.enabled` | `true` | Enable the profiler<br><br>see the [\`PROFILER\:PROFILING\`](https\://docs.progress.com/bundle/abl-reference/page/PROFILING-attribute.html) attribute |
| `ablunit.profilerOptions.filename` | `prof.out` | Location of the profiler results (\`-outfile <outfile>\`)<br><br>See the [\`PROFILER\:FILE-NAME\`](https\://docs.progress.com/bundle/abl-reference/page/DIRECTORY-attribute.html) attribute |
| `ablunit.profilerOptions.listings` |  | Output debug listings directory (\`-listings\`)<br><br>When unset (default) no listings will be output. When set to \`\\"true\\"\` listings will be output to the \`\$\{config\:ablunit.tempDir\}/listings\` directory.<br><br><ul><li>See the [\`PROFILER\:LISTINGS\`](https\://docs.progress.com/bundle/abl-reference/page/LISTINGS-attribute.html) attribute</li><li>See the [\`PROFILER\:DIRECTORY\`](https\://docs.progress.com/bundle/abl-reference/page/DIRECTORY-attribute.html) attribute</li></ul> |
| `ablunit.profilerOptions.optionsPath` | `profile.options` | Location of the \`profile.options\` file<br><br>See the [\`-profile\`](https\://docs.progress.com/bundle/openedge-startup-and-parameter-reference-122/page/Profiler-profile.html) attribute |
| `ablunit.profilerOptions.statistics` | `false` | Flag to output statistics (\`-statistics\`)<br><br>See the [\`PROFILER\:STATISTICS\`](https\://docs.progress.com/bundle/abl-reference/page/STATISTICS-attribute.html) attribute |
| `ablunit.profilerOptions.traceFilter` |  | Comma-separated string that uses wildcard matching for any procedure or class you want trace (\`-trace-filter <string>\`)<br><br>see the [\`PROFILER\:TRACE-FILTER\`](https\://docs.progress.com/bundle/abl-reference/page/TRACE-FILTER-attribute.html) attribute |
| `ablunit.profilerOptions.tracing` |  | Comma-separated string of procedure and line number pairs. A pipe (\`|\`) separates the procedure name and line number (\`-tracing <string>\`)<br><br>**Example**\: \`test1|32,test2|17\`<br><br>See the [\`PROFILER\:TRACING\`](https\://docs.progress.com/bundle/abl-reference/page/TRACING-attribute.html) attribute |
| `ablunit.profilerOptions.writeJson` | `false` | Output the results in JSON format after parsing. Writes to a file by the same name as the \`filename\` option, but with a \`.json\` extension (default\: \`prof.json\`) |
| `ablunit.progressIniPath` | `progress.ini` | Location of the \`progress.ini\` file (relative or absolute). When blank the extension will look for a \`progress.ini\` file in the repo root before creating one at \$\{config\:ablunit.tempDir\} |
| `ablunit.tempDir` |  | Location of the temporary directory used to store the \`results.xml\` file<br><br>**Examples\:**<br><br>* \`temp\`<br>* \`\$\{workspaceFolder\}\`<br>* \`C\:\\temp\` |
| `ablunit.tests.command` |  | Custom command line executed to run a test |
| `ablunit.tests.task` |  | Run tests using the specified task |
<!-- END CONFIGURATION PROPERTIES -->

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md)

## Links

* [VSCode Marketplace - ABLUnit Test Runner](https://marketplace.visualstudio.com/items?itemName=kherring.ablunit-test-provider)
* Progress Documentation
  * [Run test cases from the command prompt](https://docs.progress.com/bundle/openedge-developer-studio-help/page/Run-test-cases-from-the-command-prompt.html)
  * [Learn About ABLUnit Test Framework](https://docs.progress.com/bundle/openedge-developer-studio-help/page/Learn-About-ABLUnit-Test-Framework.html)
  * [ABLUnit Annotations](https://docs.progress.com/bundle/openedge-developer-studio-help/page/Annotations-supported-with-ABLUnit.html)
* GitHub Repo - [progress/ade](https://github.com/progress/ADE) - OpenEdge Source Files
