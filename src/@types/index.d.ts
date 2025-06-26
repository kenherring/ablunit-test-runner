import { TestItem, TextEditor, Uri } from 'vscode'

declare class ABLUnitTestRunner {
    getDebugListingPreviewEditor: (uri: Uri) => TextEditor | undefined
    getTestItems: (uri?: Uri) => TestItem[]
}
