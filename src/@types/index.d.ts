import { TextEditor, Uri } from 'vscode'

declare class ABLUnitTestRunner {
    getDebugListingPreviewEditor: (uri: Uri) => TextEditor | undefined
}
