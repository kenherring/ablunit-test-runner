# TODO

## Snippets

* add `OpenEdge.Core.Assert` methods

## Errors

### progress.ini not found

```
Running testfile.p
c:\git\ablunit-test-provider\test_projects\proj3_debugLines\progress.ini file not found. (5643)
```

This should:

* stop the run so it doesn't spin indefinitely
* mark the test as Errored
* create a default progress.ini in the storage area

## Functionality

* search propath for files instead of assuming workspace root
* test w/ multiple workspace dirs
* **results.xml**:  `failure.message` should pull in additional promsg info from $DLC/prohelp/msgdata