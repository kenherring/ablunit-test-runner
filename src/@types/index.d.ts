import { TestItem, TextEditor, Uri } from 'vscode'

declare class ABLUnitTestRunner {
    getDebugListingPreviewEditor: (uri: Uri) => TextEditor | undefined
    // getTestCount(uri?: Uri): number
    getTestItems: (uri?: Uri) => TestItem[]
}
