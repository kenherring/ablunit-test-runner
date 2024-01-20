# ABLUnit Test Runner 🏃‍♂️🏃🏃‍♀️

[![CircleCI](https://img.shields.io/circleci/build/github/kenherring/ablunit-test-runner/main?logo=circleci)](https://dl.circleci.com/status-badge/redirect/gh/kenherring/ablunit-test-runner/tree/main)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=kenherring_ablunit-test-runner&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=kenherring_ablunit-test-runner)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=kenherring_ablunit-test-runner&metric=coverage)](https://sonarcloud.io/summary/new_code?id=kenherring_ablunit-test-runner)
![Visual Studio Marketplace Version (including pre-releases)](https://img.shields.io/visual-studio-marketplace/v/kherring.ablunit-test-runner?color=blue&link=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dkherring.ablunit-test-runner)

The [ABLUnit Test Runner](https://github.com/kenherring/ablunit-test-runner/) extension for VSCode integrates [ablunit tests](https://docs.progress.com/bundle/openedge-developer-studio-help-122/page/Learn-About-ABLUnit-Test-Framework.html) into the test explorer.

## 🌴 Features

* Execute ABLUnit tests from the VSCode **Test Explorer View**
* Display test results in the VSCode **Test Results View**
* Color coded line coverage highlighting in the editor

### 📷 Code Coverage Screenshot

![code coverage example screenshot](https://github.com/kenherring/ablunit-test-runner/raw/main/docs/coverage.png)

## 📝 Supported OpenEdge Versions

This project was developed using the [Progress OpenEdge Developers Kit: Classroom Edition](https://www.progress.com/openedge/classroom-edition).  It was primarily tested with 12.2.12, but the unit tests are run for 12.7.0 during the CI builds too.

## ⛺ Configuration

Configuration is optional.  Many workspaces will work without any configuration.  However, there are advanced options available via the VSCode settings and a test profile configuration file (`.vscode/ablunit-test-profile.json`).

### 📐 Settings Configuration

The settings config allows for a few global options, described in more detail below.  This example shows a test file glob pattern and another with a path to a dbconnections `.pf` file.  The `ablunit.files.include` setting is required for the extension to find tests.


**`.vscode/settings.json` with include and exclude patterns**:

```json
{
  "ablunit.files.include": [
    "test/**/*Test.{cls,p}"
  ],
  "ablunit.files.exclude": [
    "src/sandbox/**"
  ]
}
```

**`.vscode/settings.json` with dbconnections `.pf` file**:

```json
{
  "ablunit.files.include": [
    "test/**/*Test.{cls,p}"
  ],
  "ablunit.params": "-pf path/to/dbconnections.pf"
}
```

The following table gives a brief description of the available settings via the UI or `settings.json` files.

| Setting | Default | Description |
| --- | --- | --- |
| `ablunit.discoverFilesOnActivate` | `true` | Search all workspace files for tests on extension activation.  It may be beneficial to disable this for large workspaces, in which case the extension will find tests as files are accessed. |
| `ablunit.files.include` | `[ "**/*.{cls,p}" ]` | Glob pattern array matching test files. |
| `ablunit.files.exclude` | `[ "**/.builder/**" ]` | Glob pattern array to exclude test files. |
| `ablunit.importOpenedgeProjectJson` | `true` | Import configuration settings from \`openedge-project.json\` when possible. |
| `ablunit.notificationsEnabled` | `true` | Enable/disable notifications. |
| `ablunit.test.classlabel` | `classname` | The label format for test classes. Example for class with path `com/example/myClass.cls`:<ul><li>class-type-name example: `com.example.myClass`</li><li>filename example: `myClass.cls`</li></ul> |

### 🧪 Test Profile Configuration

The `.vscode/ablunit-test-profile.json` has additional configuration similar to [launch configurations](https://code.visualstudio.com/docs/editor/debugging#_launch-configurations).

A default profile is created when using the **ABLUnit: Configure Test Profile** command and selecting **ABLUnit - Run Tests**.  This configuration has comments describing the options available.

**Note**: Only the first test profile will be imported.  In the future this extension will allow for multiple entries.

## 👷‍♂️ Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md)

## 💻 Development

* `npm install`
* Make any changes you wish
* `npm install -g --save-dev @vscode/vsce"`
* `npm test` or use the [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)

## 🔗 Links

* [VSCode Marketplace - ABLUnit Test Runner](https://marketplace.visualstudio.com/items?itemName=kherring.ablunit-test-runner)
* Progress Documentation
  * [Run test cases from the command prompt](https://docs.progress.com/bundle/openedge-developer-studio-help/page/Run-test-cases-from-the-command-prompt.html)
  * [Learn About ABLUnit Test Framework](https://docs.progress.com/bundle/openedge-developer-studio-help/page/Learn-About-ABLUnit-Test-Framework.html)
  * [ABLUnit Annotations](https://docs.progress.com/bundle/openedge-developer-studio-help/page/Annotations-supported-with-ABLUnit.html)
  * [PROFILER system handle](https://docs.progress.com/bundle/abl-reference/page/PROFILER-system-handle.html)
  * [Profiler (-profile) startup parameter](https://docs.progress.com/bundle/openedge-startup-and-parameter-reference/page/Profiler-profile.html)
* GitHub Repo - [progress/ade](https://github.com/progress/ADE) - OpenEdge Source Files
* Docker Hub - Progress Software Corporation - [progresssoftware/prgs-oedb](https://hub.docker.com/r/progresssoftware/prgs-oedb)

## 🤓 About Me

This is my first VSCode extension, and my first TypeScript project. I am sure there are many ways to improve the code, and I welcome any feedback.  I'm also open to collaboration for anyone who might wish to contribute.

Quality code is my passion.  Unit testing is an important component of ensuring code remains functional when future changes are made.  I hope this extension helps others to embrace [TDD](https://en.wikipedia.org/wiki/Test-driven_development) and improve their code.
