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

### Configuration - VSCode Configuration (`.vscode/settings.json`, et al.)

| Setting | Default | Description |
| --- | --- | --- |
| `ablunit.discoverFilesOnActivate` | `true` | Search all workspace files for test cases.  It may be beneficial to disable this for large workspaces, in which case the extension will find tests as files are accessed. |
| `ablunit.files.include` | `[ "**/*.{cls,p}" ]` | Glob pattern array to include test files |
| `ablunit.files.exclude` | `[ "**/.builder/**" ]` | Glob pattern array to exclude test files |
| `ablunit.importOpenedgeProjectJson` | `true` | Import configuration settings from \`openedge-project.json\` when possible |
| `ablunit.notificationsEnabled` | `true` | Enable/disable notifications |
| `ablunit.test.classlabel` | `classname` | The label to display for test classes. Example for class with path \`com/example/myClass.cls\`\:<br><br>* class-type-name example\: \`com.example.myClass\`<br>* filename example\: \`myClass.cls\` |

### Configuration - Test Run Configuration (`.vscode/ablunit-test-profile.json`)

<!-- TODO -->

<!-- START CONFIGURATION PROPERTIES -->
## Configuration Properties

| Property | Default | Description |
| --- | --- | --- |

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md)

## Links

* [VSCode Marketplace - ABLUnit Test Runner](https://marketplace.visualstudio.com/items?itemName=kherring.ablunit-test-provider)
* Progress Documentation
  * [Run test cases from the command prompt](https://docs.progress.com/bundle/openedge-developer-studio-help/page/Run-test-cases-from-the-command-prompt.html)
  * [Learn About ABLUnit Test Framework](https://docs.progress.com/bundle/openedge-developer-studio-help/page/Learn-About-ABLUnit-Test-Framework.html)
  * [ABLUnit Annotations](https://docs.progress.com/bundle/openedge-developer-studio-help/page/Annotations-supported-with-ABLUnit.html)
  * [PROFILER system handle](https://docs.progress.com/bundle/abl-reference/page/PROFILER-system-handle.html)
  * [Profiler (-profile) startup parameter](https://docs.progress.com/bundle/openedge-startup-and-parameter-reference/page/Profiler-profile.html)
* GitHub Repo - [progress/ade](https://github.com/progress/ADE) - OpenEdge Source Files
