```
Visual Studio Code 1.86.1

Usage: code.exe [options][paths...]

To read output from another program, append '-' (e.g. 'echo Hello World | code.exe -')

Options
  -g --goto <file:line[:character]>          Open a file at the path on the
                                             specified line and character
                                             position.
  -n --new-window                            Force to open a new window.
  -r --reuse-window                          Force to open a file or folder in
                                             an already opened window.
  --user-data-dir <dir>                      Specifies the directory that user
                                             data is kept in. Can be used to
                                             open multiple distinct instances
                                             of Code.
  --profile <profileName>                    Opens the provided folder or
                                             workspace with the given profile
                                             and associates the profile with
                                             the workspace. If the profile
                                             does not exist, a new empty one
                                             is created.

Extensions Management
  --extensions-dir <dir>              Set the root path for extensions.
  --list-extensions                   List the installed extensions.
  --show-versions                     Show versions of installed extensions,
                                      when using --list-extensions.
  --category <category>               Filters installed extensions by provided
                                      category, when using --list-extensions.
  --install-extension <ext-id | path> Installs or updates an extension. The
                                      argument is either an extension id or a
                                      path to a VSIX. The identifier of an
                                      extension is '${publisher}.${name}'. Use
                                      '--force' argument to update to latest
                                      version. To install a specific version
                                      provide '@${version}'. For example:
                                      'vscode.csharp@1.2.3'.
  --pre-release                       Installs the pre-release version of the
                                      extension, when using
                                      --install-extension
  --uninstall-extension <ext-id>      Uninstalls an extension.
  --update-extensions                 Update the installed extensions.
  --enable-proposed-api <ext-id>      Enables proposed API features for
                                      extensions. Can receive one or more
                                      extension IDs to enable individually.

Troubleshooting
  --verbose                       Print verbose output (implies --wait).
  --log <level>                   Log level to use. Default is 'info'. Allowed
                                  values are 'critical', 'error', 'warn',
                                  'info', 'debug', 'trace', 'off'. You can
                                  also configure the log level of an extension
                                  by passing extension id and log level in the
                                  following format:
                                  '${publisher}.${name}:${logLevel}'. For
                                  example: 'vscode.csharp:trace'. Can receive
                                  one or more such entries.
  -s --status                     Print process usage and diagnostics
                                  information.
  --sync <on | off>               Turn sync on or off.
  --disable-gpu                   Disable GPU hardware acceleration.
  --telemetry                     Shows all telemetry events which VS code
                                  collects.

Subcommands
  tunnel       Make the current machine accessible from vscode.dev or other
               machines through a secure tunnel
  serve-web    Run a server that displays the editor UI in browsers.
```
