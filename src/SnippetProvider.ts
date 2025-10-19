import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionItemProvider, CompletionItemTag, CompletionList, InlineCompletionContext, InlineCompletionItem, InlineCompletionItemProvider, InlineCompletionList, MarkdownString, Position, ProviderResult, Range, SnippetString, TextDocument, TextEdit } from 'vscode'
import { workspace } from '../test/testCommon'

interface ISnippetOptions {
	enabled: boolean
	annotations: boolean
	events: boolean
	references: boolean
	methods: boolean
}

export class SnippetProvider implements CompletionItemProvider {
	private readonly globalItems: CompletionItem[] = []
	private readonly classItems: CompletionItem[] = []
	private readonly procedureItems: CompletionItem[] = []

	constructor (public oeVersion = '12.8') {
		this.createGlobalSnippets()
		this.createClassSnippets()
		this.createProcedureSnippets()

		for (const i of this.classItems) {
			i.kind = CompletionItemKind.Method
		}
		for (const i of this.procedureItems) {
			i.kind = CompletionItemKind.Function
		}

		const allItems = [...this.globalItems, ...this.classItems, ...this.procedureItems]
		for (const i of allItems) {
			const lbl = typeof i.label == 'string' ? i.label : i.label.label
			if (!lbl.startsWith('@')) {
				continue
			}

			i.detail = 'ablunit annotation'
			i.kind = CompletionItemKind.Snippet
			if (!i.documentation || typeof i.documentation == 'string') {
				i.documentation = new MarkdownString(i.documentation)
			}
			i.documentation.value.trimEnd()
			i.documentation.appendMarkdown('\n')
			i.documentation.appendMarkdown('* [Annotations supported by ABLUnit](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-developer-studio-help/page/Annotations-supported-with-ABLUnit.html') + ')')
			if (this.isLifecycleAnnotation(lbl)) {
				i.documentation.appendMarkdown('\n* [Lifecycle of ABLUnit framework](https://docs.progress.com/bundle/openedge-developer-studio-help/page/Lifecycle-of-ABLUnit-framework.html)')
			}

			i.tags = this.isDeprecated(lbl)
		}
	}

	private newCompletionItem (label: string, category: 'global' | 'class' | 'procedure') {
		const item = new CompletionItem(label)
		item.insertText = new SnippetString(label)
		item.kind = CompletionItemKind.Snippet
		switch (category) {
			case 'global':
				this.globalItems.push(item)
				break
			case 'class':
				this.classItems.push(item)
				break
			case 'procedure':
				this.procedureItems.push(item)
				break
		}
		return item
	}

	private createGlobalSnippets () {
		let gci = this.newCompletionItem('block-level on error undo, throw.', 'global')
		gci.kind = CompletionItemKind.Event
		gci.documentation = new MarkdownString(
			'You must have the `[BLOCK | ROUTINE]-LEVEL ON ERROR UNDO, THROW` statement in the test files to run the ABLUnit test cases.\n\n' +
			'* [Run test cases and test suites](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-developer-studio-help/page/Run-test-cases-and-test-suites.html') + ')\n' +
			'* [Support for structured error handling](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-developer-studio-help/page/Support-for-structured-error-handling.html') + ')'
		)

		gci = this.newCompletionItem('routine-level on error undo, throw.', 'global')
		gci.kind = CompletionItemKind.Event
		gci.documentation = this.globalItems[0].documentation

		gci = this.newCompletionItem('using OpenEdge.Core.Assert.', 'global')
		gci.kind = CompletionItemKind.Reference
		gci.documentation = new MarkdownString(
			'* [OpenEdge.Core.Assert](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-abl-api-reference-128/page/OpenEdge.Core.Assert.html') + ')\n' +
			'* [USING statement](' + this.urlForVersion('https://docs.progress.com/bundle/abl-reference/page/USING-statement.html') + ')'
		)

		gci = this.newCompletionItem('@Ignore.', 'global')
		gci.documentation = new MarkdownString(
			'Ignores the test. You can use this annotation when you are still working on a code, the test case is not ready to run, or if the execution time of test is too long to be included.'
		)

		this.globalItems.push(...this.createAssertSnippets())
	}

	private createClassSnippets () {
		let cci = this.newCompletionItem('@TestSuite', 'class')
		cci.insertText = new SnippetString('@TestSuite(classes="${1:classList}").')
		cci.documentation = new MarkdownString(
			'Runs a suite of test cases from a specified list.\n\n' +
			'* [Test Suite Class](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-developer-studio-help/page/Test-Suite-Class.html') + ')'
		)

		cci = this.newCompletionItem('@Test method', 'class')
		cci.insertText = new SnippetString(
			'@Test.\n' +
			'method public void ${1:methodName} () :\n' +
			'\t${2://TODO: Implement test method}\n' +
			'end method.'
		)
		cci.documentation = new MarkdownString(
			'* [Test Class](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-developer-studio-help/page/Test-Class.html') + ')'
		)

		cci = this.newCompletionItem('@Test method exception', 'class')
		cci.documentation = 'Fails the test if the method does not throw the exception mentioned in the expected attribute.'
		cci.insertText = new SnippetString(
			'@Test (expected="${1:ExceptionType}").\n' +
			'method public void testExceptionMethod () :\n' +
			'\t${2:runMethodThrowsException().} //Throws ${1}\n' +
			'end method.'
		)

		cci = this.newCompletionItem('@Setup method', 'class')
		cci.documentation = 'To be deprecated, use @BeforeEach'
		cci.insertText = new SnippetString(
			'@Setup.\n' +
			'method public void beforeEach () :\n' +
			'\t// Executes before each test\n' +
			'\t${1:// do setup here}\n' +
			'end method.'
		)

		cci = this.newCompletionItem('@Before method', 'class')
		cci.documentation = 'To be deprecated, use @BeforeAll'
		cci.insertText = new SnippetString(
			'@BeforeEach.\n' +
			'method public void beforeEach () :\n' +
			'\t// Executes before each test\n' +
			'\t${1:// do setup here}\n' +
			'end method.'
		)

		cci = this.newCompletionItem('@BeforeAll method', 'class')
		cci.documentation = 'Executes the procedure once per class, before the start of all tests. This annotation can be used to perform time-sensitive activities such as connecting to a database.'
		cci.insertText = new SnippetString(
			'@BeforeAll.\n' +
			'method public void beforeAll () :\n' +
			'\t// Executes before any test\n' +
			'\t${1:// do setup here}\n' +
			'end method.'
		)

		cci = this.newCompletionItem('@BeforeEach method', 'class')
		cci.documentation = 'Executes the method before each test. This annotation prepares the test environment such as reading input data or initializing the class.'
		cci.insertText = new SnippetString(
			'@BeforeEach.\n' +
			'method public void beforeEach () :\n' +
			'\t// Executes before each test\n' +
			'\t${1:// do setup here}\n' +
			'end method.'
		)

		cci = this.newCompletionItem('@Teardown method', 'class')
		cci.documentation = 'To be deprecated, use @AfterEach'
		cci.insertText = new SnippetString(
			'@Teardown.\n' +
			'method public void afterEach () :\n' +
			'\t// Executes after each tests\n' +
			'\t${1:// do some cleanup here}\n' +
			'end method.'
		)

		cci = this.newCompletionItem('@After method', 'class')
		cci.documentation = 'To be deprecated, use @AfterAll'
		cci.insertText = new SnippetString(
			'@After.\n' +
			'method public void afterAll () :\n' +
			'\t// Executes before after all the tests are executed\n' +
			'end method.'
		)

		cci = this.newCompletionItem('@AfterAll method', 'class')
		cci.documentation = 'Executes the method once, after all the tests are executed. This annotation is used to perform clean-up activities such as disconnecting from a database.'
		cci.insertText = new SnippetString(
			'@AfterAll.\n' +
			'method public void afterAll() :\n' +
			'\t// Executes once after all tests are executed\n' +
			'end method.'
		)

		cci = this.newCompletionItem('@AfterEach method', 'class')
		cci.documentation = 'Executes the method after each test. This annotation cleans up the test environment such as deleting temporary data or restoring defaults.'
		cci.insertText = new SnippetString(
			'@AfterEach.\n' +
			'method public void afterEach () :\n' +
			'\t// Executes after each test\n' +
			'end method.'
		)
	}

	private createProcedureSnippets () {
		let pci = this.newCompletionItem('@TestSuite', 'procedure')
		pci.insertText = new SnippetString('@TestSuite(procedures="${1:procedureList}").')
		pci.documentation = new MarkdownString(
			'Runs a suite of test cases from a specified list.\n\n' +
			'* [Test Suite Procedure](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-developer-studio-help/page/Test-Suite-Procedure.html') + ')'
		)

		pci = this.newCompletionItem('@Test Procedure', 'procedure')
		pci.insertText = new SnippetString('@Test.\nprocedure ${1:procedureName} :\n\t${2://TODO: Implement test procedure}\nend procedure.')
		pci.documentation = new MarkdownString(
			'A procedure that is a test procedure\n\n' +
			'* [Test Procedure](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-developer-studio-help/page/Test-Procedure.html') + ')'
		)

		pci = this.newCompletionItem('@Test procedure exception', 'procedure')
		pci.insertText = new SnippetString(
			'@Test (expected="${1:ExceptionType}").\n' +
			'procedure testExceptionProc :\n' +
			'\t${2:runProcThrowsException().} //Throws ${1}\n' +
			'end procedure.'
		)
		pci.documentation = new MarkdownString(
			'Fails the test if the procedure does not throw the exception mentioned in the expected attribute.\n\n' +
			'* [Test Procedure](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-developer-studio-help/page/Test-Procedure.html') + ')'
		)


		pci = this.newCompletionItem('@Setup procedure', 'procedure')
		pci.insertText = new SnippetString(
			'@Setup.\n' +
			'procedure beforeAll :\n' +
			'\t// Executes before each test\n' +
			'\t${1:// do setup here}\n' +
			'end procedure.'
		)
		pci.documentation = 'To be deprecated, use @BeforeAll'

		pci = this.newCompletionItem('@Before procedure', 'procedure')
		pci.insertText = new SnippetString(
			'@Before.\n' +
			'procedure beforeEach :\n' +
			'\t// Executes once per program before the start of all tests\n' +
			'\t${1:// do setup here}\n' +
			'end procedure.'
		)
		pci.documentation = 'To be deprecated, use @BeforeEach'

		pci = this.newCompletionItem('@BeforeAll procedure', 'procedure')
		pci.insertText = new SnippetString(
			'@BeforeAll.\n' +
			'procedure beforeAll :\n' +
			'\t// Executes before each test\n' +
			'\t${1:// do setup here}\n' +
			'end procedure.'
		)
		pci.documentation = 'Executes the procedure once per program, before the start of all tests. This annotation can be used to perform time-sensitive activities such as connecting to a database.'

		pci = this.newCompletionItem('@BeforeEach procedure', 'procedure')
		pci.insertText = new SnippetString(
			'@BeforeEach.\n' +
			'procedure beforeEach :\n' +
			'\t// Executes once per program before the start of all tests\n' +
			'\t${1:// do setup here}\n' +
			'end procedure.'
		)
		pci.documentation = 'Executes the procedure after each test. This annotation cleans up the test environment such as deleting temporary data or restoring defaults.'

		pci = this.newCompletionItem('@Teardown procedure', 'procedure')
		pci.insertText = new SnippetString(
			'@TearDown.\n' +
			'procedure afterEach :\n' +
			'\t// Executes after each test\n' +
			'\t${1:// do some cleanup here}\n' +
			'end procedure'
		)
		pci.documentation = 'To be deprecated, use @AfterEach'

		pci = this.newCompletionItem('@After procedure', 'procedure')
		pci.insertText = new SnippetString(
			'@After.\n' +
			'procedure afterAll :\n' +
			'\t// Executes once after all the tests are executed\n' +
			'end procedure.'
		)
		pci.documentation = 'To be deprecated, use @AfterAll'

		pci = this.newCompletionItem('@AfterAll procedure', 'procedure')
		pci.insertText = new SnippetString(
			'@AfterAll.\n' +
			'procedure afterAll :\n' +
			'\t// Executes once after all the tests are executed\n' +
			'end procedure.'
		)
		pci.documentation = 'Executes the procedure once, after all the tests are executed. This annotation is used to perform clean-up activities such as disconnecting from a database.'

		pci = this.newCompletionItem('@AfterEach procedure', 'procedure')
		pci.insertText = new SnippetString(
			'@AfterEach.\n' +
			'procedure afterEach :\n' +
			'\t// Executes after each test\n' +
			'\t${1:// do some cleanup here}\n' +
			'end procedure.'
		)
		pci.documentation = 'Executes the procedure after each test. This annotation cleans up the test environment such as deleting temporary data or restoring defaults.'
	}

	private createAssertSnippets () {
		const items = []
		items.push(new CompletionItem('Assert:Equals(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:HasDeterminateExtent(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:HasDeterminateExtent(${1:input})'))
		items.push(new CompletionItem('Assert:IsAbstract(${1:input})'))
		items.push(new CompletionItem('Assert:IsAvailable(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsAvailable(${1:input})'))
		items.push(new CompletionItem('Assert:IsDecimal(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsDecimal(${1:input})'))
		items.push(new CompletionItem('Assert:IsEmpty(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsEmpty(${1:input})'))
		items.push(new CompletionItem('Assert:IsFalse(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsFalse(${1:input})'))
		items.push(new CompletionItem('Assert:IsFinal(${1:input})'))
		items.push(new CompletionItem('Assert:IsIn(${1:input}, ${2:input}, ${3:input}, ${4:input})'))
		items.push(new CompletionItem('Assert:IsIn(${1:input}, ${2:input}, ${3:input})'))
		items.push(new CompletionItem('Assert:IsIndeterminateArray(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsIndeterminateArray(${1:input})'))
		items.push(new CompletionItem('Assert:IsInt64(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsInt64(${1:input})'))
		items.push(new CompletionItem('Assert:IsInteger(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsInteger(${1:input})'))
		items.push(new CompletionItem('Assert:IsInterface(${1:input})'))
		items.push(new CompletionItem('Assert:IsLogical(${1:input}, ${2:input}, ${3:input})'))
		items.push(new CompletionItem('Assert:IsLogical(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsLogical(${1:input})'))
		items.push(new CompletionItem('Assert:IsNegative(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsNegative(${1:input})'))
		items.push(new CompletionItem('Assert:IsNull(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsNull(${1:input})'))
		items.push(new CompletionItem('Assert:IsPositive(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsPositive(${1:input})'))
		items.push(new CompletionItem('Assert:IsSerializable(${1:input})'))
		items.push(new CompletionItem('Assert:IsTrue(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsTrue(${1:input})'))
		items.push(new CompletionItem('Assert:IsType(${1:input}, ${2:input}, ${3:input})'))
		items.push(new CompletionItem('Assert:IsType(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsUnknown(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsUnknown(${1:input})'))
		items.push(new CompletionItem('Assert:IsZero(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsZero(${1:input})'))
		items.push(new CompletionItem('Assert:IsZeroOrNegative(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsZeroOrNegative(${1:input})'))
		items.push(new CompletionItem('Assert:IsZeroOrPositive(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:IsZeroOrPositive(${1:input})'))
		items.push(new CompletionItem('Assert:NonZero(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:NonZero(${1:input})'))
		items.push(new CompletionItem('Assert:NotAbstract(${1:input})'))
		items.push(new CompletionItem('Assert:NotAvailable(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:NotAvailable(${1:input})'))
		items.push(new CompletionItem('Assert:NotEmpty(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:NotEmpty(${1:input})'))
		items.push(new CompletionItem('Assert:NotEqual(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:NotFalse(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:NotFalse(${1:input})'))
		items.push(new CompletionItem('Assert:NotFinal(${1:input})'))
		items.push(new CompletionItem('Assert:NotIn(${1:input}, ${2:input}, ${3:input}, ${4:input})'))
		items.push(new CompletionItem('Assert:NotIn(${1:input}, ${2:input}, ${3:input})'))
		items.push(new CompletionItem('Assert:NotInterface(${1:input})'))
		items.push(new CompletionItem('Assert:NotNull(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:NotNull(${1:input})'))
		items.push(new CompletionItem('Assert:NotNullOrEmpty(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:NotNullOrEmpty(${1:input})'))
		items.push(new CompletionItem('Assert:NotNullOrZero(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:NotNullOrZero(${1:input})'))
		items.push(new CompletionItem('Assert:NotSerializable(${1:input})'))
		items.push(new CompletionItem('Assert:NotTrue(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:NotTrue(${1:input})'))
		items.push(new CompletionItem('Assert:NotType(${1:input}, ${2:input}, ${3:input})'))
		items.push(new CompletionItem('Assert:NotType(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:NotUnknown(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:NotUnknown(${1:input})'))
		items.push(new CompletionItem('Assert:NotUnknownOrEmpty(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:NotUnknownOrEmpty(${1:input})'))
		items.push(new CompletionItem('Assert:NotZero(${1:input}, ${2:input})'))
		items.push(new CompletionItem('Assert:NotZero(${1:input})'))
		items.push(new CompletionItem('Assert:RaiseError(${1:input})'))

		for (const i of items) {
			i.detail = 'OpenEdge.Core.Assert'
			if (typeof i.label == 'string') {
				i.insertText = new SnippetString(i.label + '.')
				i.label = i.label.replace(/\$\{\d:input\}/g, 'param')
			}
			i.kind = CompletionItemKind.Method
			i.documentation = new MarkdownString(
				'* [OpenEdge.Core.Assert](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-abl-api-reference-128/page/OpenEdge.Core.Assert.html') + ')'
			)
		}
		return items
	}

	private itemEnabled (item: CompletionItem, opts: ISnippetOptions) {
		const label = typeof item.label === 'string' ? item.label : item.label.label
		if (label.startsWith('@')) {
			return opts.annotations
		}
		switch (item.kind) {
			case CompletionItemKind.Event:
				return opts.events
			case CompletionItemKind.Reference:
				return opts.references
			case CompletionItemKind.Method:
				return opts.methods
			default:
				return true
		}
	}

	provideCompletionItems (document: TextDocument, pos: Position, _token: CancellationToken, _context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList> {
		if (document.languageId != 'abl') {
			return undefined
		}


		const snippetOptions: ISnippetOptions = workspace.getConfiguration('ablunit').get('suggest') ?? {
			enabled: true,
			annotations: true,
			events: true,
			references: true,
			methods: true,
		}
		if (!snippetOptions.enabled) {
			return undefined
		}

		this.setAssertPrefix(document)


		const endOfLine = document.positionAt(document.offsetAt(pos.with(pos.line + 1, 0)) - 1)
		const wordBefore = document.getText(new Range(pos.with(pos.line, 0), pos)).split(/\s/).pop() ?? ''
		const wordAfter = document.getText(new Range(pos, endOfLine)).split(/\s/)[0] ?? ''

		const ret = new CompletionList()
		ret.items.push(...this.globalItems)
		if (document.uri.fsPath.endsWith('.cls')) {
			ret.items.push(...this.classItems)
		} else if (document.uri.fsPath.endsWith('.p')) {
			ret.items.push(...this.procedureItems)
		}
		ret.items = ret.items.filter(item => this.itemEnabled(item, snippetOptions))

		const documentText = document.getText().toLowerCase()
		if (documentText.includes('block-level ') || documentText.includes('routine-level ')) {
			ret.items = ret.items.filter(item => {
				const label = typeof item.label == 'string' ? item.label : item.label.label
				return !label.startsWith('block-level on error') && !label.startsWith('routine-level on error')
			})
		}
		if (documentText.includes('using openedge.core.assert')) {
			ret.items = ret.items.filter(item => {
				const label = typeof item.label == 'string' ? item.label : item.label.label
				return label != 'using OpenEdge.Core.Assert.'
			})
		}

		for (const r of ret.items) {
			r.range = undefined
			if (r.label == 'using OpenEdge.Core.Assert') {
				this.addUsingEdits(r, document)
			}
		}

		if (wordBefore != '') {

			for (const r of ret.items) {
				this.setRange(r, pos, wordBefore, wordAfter)
			}
		}

		return ret
	}

	private setAssertPrefix (document: TextDocument) {
		// OpenEdge.Core.Assert <--> Assert
		let searchVal = 'Assert:'
		let replaceVal = 'OpenEdge.Core.Assert:'
		let hasUsing = false
		if (document.getText().toLowerCase().includes('using openedge.core.assert.')) {
			searchVal = 'OpenEdge.Core.Assert:'
			replaceVal = 'Assert:'
			hasUsing = true
		}

		for (const i of this.globalItems) {
			if (typeof i.label == 'string' && i.label.startsWith(searchVal)) {
				i.label = replaceVal + i.label.substring(searchVal.length)
			}
			if (i.insertText instanceof SnippetString && i.insertText.value.startsWith(searchVal)) {
				i.insertText = new SnippetString(replaceVal + i.insertText.value.substring(searchVal.length))
			} else if (typeof i.insertText == 'string' && i.insertText.startsWith(searchVal)) {
				i.insertText = replaceVal + i.insertText.substring(searchVal.length)
			}
		}
		return hasUsing
	}

	private addUsingEdits (item: CompletionItem, document: TextDocument) {
		const docText = document.getText()
		let idx = docText.indexOf('OpenEdge.Core.Assert:')
		item.additionalTextEdits = []
		while (idx >= 0) {
			const posEdit = document.positionAt(idx)
			item.additionalTextEdits.push(new TextEdit(
				new Range(posEdit, posEdit.translate(0, 'OpenEdge.Core.Assert:'.length)),
				'Assert:')
			)
			idx = docText.indexOf('OpenEdge.Core.Assert:', idx + 1)
		}
	}

	private setRange (r: CompletionItem, pos: Position, wordBefore: string, wordAfter: string) {
		const lbl = typeof r.label == 'string' ? r.label : r.label.label
		if (!lbl.startsWith('@') && !lbl.startsWith('Assert:') && !lbl.startsWith('OpenEdge.Core.Assert:')) {
			return
		}

		if (!r.range) {
			let posEnd = pos.translate(0, wordAfter.length)
			if ((lbl.startsWith('Assert:') || lbl.startsWith('OpenEdge.Core.Assert:')) && wordAfter.indexOf('(') > 0) {
				posEnd = pos.translate(0, wordAfter.indexOf('('))
			}
			r.range = new Range(
				pos.translate(0, 0 - wordBefore.length),
				posEnd
			)
		}
	}

	_resolveCompletionItem (item: CompletionItem, _token: CancellationToken): ProviderResult<CompletionItem> {
		return item
	}

	private urlForVersion (url: string): string {
		if (this.oeVersion >= '12.8') {
			return url
		} else if (this.oeVersion >= '12.2') {
			url = url.replace(
				'/openedge-developer-studio-help/',
				'/openedge-developer-studio-help-122/'
			)
			url = url.replace(
				'/abl-reference/',
				'/openedge-abl-reference-122/'
			)
		} else if (this.oeVersion >= '11.7') {
			url = url.replace(
				'/openedge-developer-studio-help/',
				'/openedge-developer-studio-olh-117/'
			)

			url = url.replace(
				'/abl-reference/',
				'/openedge-abl-reference-117/'
			)
		}

		return url
	}

	private isLifecycleAnnotation (label: string) {
		return label.startsWith('@Setup') ||
			label.startsWith('@Before') ||
			label.startsWith('@After') ||
			label.startsWith('@Teardown')
	}

	private isDeprecated (label: string) {
		const annotation = label.split(' ')[0]
		if (annotation == '@Setup' || annotation == '@Before' || annotation == '@After' || annotation == '@Teardown') {
			return [CompletionItemTag.Deprecated]
		}
		return undefined
	}
}


export class InlineProvider extends SnippetProvider implements InlineCompletionItemProvider  {

	async provideInlineCompletionItems (document: TextDocument, position: Position, _context: InlineCompletionContext, token: CancellationToken) {
		let ret = await this.provideCompletionItems(document, position, token, {triggerKind: 0, triggerCharacter: undefined})
		if (ret instanceof CompletionList) {
			ret = ret.items
		}
		if (!ret) {
			return
		}

		const inline = []
		for (const s of ret) {
			if (s.insertText && s.range instanceof Range) {
				const i = new InlineCompletionItem(s.insertText, s.range, s.command)
				inline.push(i)
			}
		}
		return new InlineCompletionList(inline)
	}
}
