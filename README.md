# ABLUnit Test Runner 🏃‍♂️🏃🏃‍♀️

[![CircleCI](https://img.shields.io/circleci/build/github/kenherring/ablunit-test-runner/main?logo=circleci)](https://dl.circleci.com/status-badge/redirect/gh/kenherring/ablunit-test-runner/tree/main)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=kenherring_ablunit-test-runner&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=kenherring_ablunit-test-runner)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=kenherring_ablunit-test-runner&metric=coverage)](https://sonarcloud.io/summary/new_code?id=kenherring_ablunit-test-runner)
[![VSCode Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/kherring.ablunit-test-runner?include_prereleases&logo=visual%20studio%20code&logoColor=blue&color=blue)](https://marketplace.visualstudio.com/items?itemName=kherring.ablunit-test-runner)

The [ABLUnit Test Runner](https://github.com/kenherring/ablunit-test-runner/) extension for VSCode integrates [ablunit tests](https://docs.progress.com/bundle/openedge-developer-studio-help-122/page/Learn-About-ABLUnit-Test-Framework.html) into the test explorer.

## 🌴 Features

* Execute/Debug ABLUnit tests from the VSCode **Test Explorer View**
* Display test results in the VSCode **Test Results View**
  * View [code coverage](https://code.visualstudio.com/docs/debugtest/testing#_test-coverage) in VSCode
* **Debug Listing Preview** editor synced with source code

### 📷 Code Coverage Screenshot

![code coverage example screenshot](https://github.com/kenherring/ablunit-test-runner/raw/main/resources/images/coverage.png)

### 🐞 Debug Listing Preview

![Debug Listing Preview screenshot](https://github.com/kenherring/ablunit-test-runner/raw/main/resources/images/debug_listing_preview.gif)

## 📝 Supported OpenEdge Versions

This project was developed using the [Progress OpenEdge Developers Kit: Classroom Edition](https://www.progress.com/openedge/classroom-edition).  It was primarily tested with 12.8.1, but the unit tests are run for 12.2 and 12.8.9 during the CI builds too.

## ⛺ Configuration

Configuration is optional.  Many workspaces will work without any configuration.  However, there are advanced options available via the VSCode settings and test profile configuration.

### 📐 Settings Configuration

The settings config allows for a few global options, described in more detail below.  This example shows a test file glob pattern.

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

The following table gives a brief description of the available settings via the UI or `settings.json` files.

| Setting | Default | Description |
| --- | --- | --- |
| `ablunit.discoverAllTestsOnActivate` | `true` | Search all workspace files for tests on extension activation.  It may be beneficial to disable this for large workspaces, in which case the extension will find tests as files are accessed. |
| `ablunit.debug.hide` | `false` | Hide debug tests run button in the test explorer view. Extension must be reloaded for this setting to take effect. |
| `ablunit.files.include` | `[ "**/*.{cls,p}" ]` | Glob pattern array matching test files. |
| `ablunit.files.exclude` | `[ "**/.builder/**", "**/.pct/** ]` | Glob pattern array to exclude test files. |
| `ablunit.test.classlabel` | `classname` | The label format for test classes. Example for class with path `com/example/myClass.cls`:<ul><li>class-type-name example: `com.example.myClass`</li><li>filename example: `myClass.cls`</li></ul> |

### 🧪 Test Profile Configuration

Access the test profile configuration in vscode via the **Test: Configure Test Profiles** command.  Test profile configuration is stored in `.vscode/ablunit-test-profile.json`.  Configuration details are available via JSON schema/intellisense and can be found in the sample file [`./resources/ablunit-test-profile.detail.jsonc`](./resources/ablunit-test-profile.detail.jsonc).

The `.vscode/ablunit-test-profile.json` has additional configuration similar to [launch configurations](https://code.visualstudio.com/docs/editor/debugging#_launch-configurations).

**Note**: The configuration is an array but only the first test profile will be imported.  In the future this extension *may* allow for multiple entries.  If you have suggestions for use cases please reach out via GitHub issues.

## 👷‍♂️ Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md)

## 💻 Development

* `npm install`
* Make any changes you wish
* `npm test` or use the [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner) extension

## 🔗 Links

* [VSCode Marketplace - ABLUnit Test Runner](https://marketplace.visualstudio.com/items?itemName=kherring.ablunit-test-runner)
* [VSCode Marketplace - ABL Developer Pack](https://marketplace.visualstudio.com/items?itemName=cverbiest.abl-developer-pack)
* Progress Documentation
  * [Run test cases from the command prompt](https://docs.progress.com/bundle/openedge-developer-studio-help/page/Run-test-cases-from-the-command-prompt.html)
  * [Learn About ABLUnit Test Framework](https://docs.progress.com/bundle/openedge-developer-studio-help/page/Learn-About-ABLUnit-Test-Framework.html)
  * [ABLUnit Annotations](https://docs.progress.com/bundle/openedge-developer-studio-help/page/Annotations-supported-with-ABLUnit.html)
  * [PROFILER system handle](https://docs.progress.com/bundle/abl-reference/page/PROFILER-system-handle.html)
  * [Profiler (-profile) startup parameter](https://docs.progress.com/bundle/openedge-startup-and-parameter-reference/page/Profiler-profile.html)
* GitHub Repo - [progress/ade](https://github.com/progress/ADE) - OpenEdge Source Files
* Docker Hub - [progresssoftware/prgs-oedb](https://hub.docker.com/r/progresssoftware/prgs-oedb) - Progress Software Corporation
* In the news 📰
  * Baltic Amadeus Blog - [ABLUnit Testing in VS Code with the ABLUnit Test Runner Extension](https://www.ba.lt/en/news/ablunit-testing-in-vs-code/)
* My other projects
  * [BATS Test Runner](https://github.com/kenherring/bats-test-runner) - Bash Automated Testing System (BATS) test runner

## 🤓 About Me

This is my first VSCode extension, and my first TypeScript project. I am sure there are many ways to improve the code, and I welcome any feedback.  I'm also open to collaboration for anyone who might wish to contribute.

Quality code is my passion.  Unit testing is an important component of ensuring code remains functional when future changes are made.  I hope this extension helps others embrace [TDD](https://en.wikipedia.org/wiki/Test-driven_development) and improve their code.
