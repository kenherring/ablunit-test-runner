import { log } from 'ChannelLogger'
import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionItemProvider, CompletionItemTag, CompletionList, InlineCompletionContext, InlineCompletionItem, InlineCompletionItemProvider, InlineCompletionList, MarkdownString, Position, ProviderResult, Range, SnippetString, TextDocument, TextEdit } from 'vscode'

export class SnippetProvider implements CompletionItemProvider {
	private readonly globalItems: CompletionItem[] = []
	private readonly classItems: CompletionItem[] = []
	private readonly procedureItems: CompletionItem[] = []
	// private readonly globalItems = new CompletionList()
	// private readonly classItems = new CompletionList()
	// private readonly procedureItems = new CompletionList()

	constructor (public oeVersion = '12.8') {
		log.info('SnippetProvider constructor')

		// ---------- global items ---------- //

		const gci1 = new CompletionItem('block-level on error undo, throw.', CompletionItemKind.Snippet)
		gci1.kind = CompletionItemKind.Event
		gci1.documentation = new MarkdownString(
			'You must have the `[BLOCK | ROUTINE]-LEVEL ON ERROR UNDO, THROW` statement in the test files to run the ABLUnit test cases.\n' +
			'\n' +
			'* [Run test cases and test suites](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-developer-studio-help/page/Run-test-cases-and-test-suites.html') + ')\n' +
			'* [Support for structured error handling](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-developer-studio-help/page/Support-for-structured-error-handling.html') + ')'
		)
		this.globalItems.push(gci1)

		const gci2 = new CompletionItem('routine-level on error undo, throw.', CompletionItemKind.Snippet)
		gci1.kind = CompletionItemKind.Event
		gci2.insertText = new SnippetString('routine-level on error undo, throw.')
		gci2.documentation = gci1.documentation
		this.globalItems.push(gci2)

		const gci3 = new CompletionItem('using OpenEdge.Core.Assert.', CompletionItemKind.Snippet)
		gci3.kind = CompletionItemKind.Reference
		// gci3.kind = CompletionItemKind.Unit
		gci3.insertText = new SnippetString('using OpenEdge.Core.Assert.')
		gci3.documentation = new MarkdownString(
			'* [OpenEdge.Core.Assert](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-abl-api-reference-128/page/OpenEdge.Core.Assert.html') + ')\n' +
			'* [USING statement](' + this.urlForVersion('https://docs.progress.com/bundle/abl-reference/page/USING-statement.html') + ')'
		)
		this.globalItems.push(gci3)

		this.globalItems.push(...this.createAssertSnippets())



		const gci4 = new CompletionItem('@Ignore', CompletionItemKind.Snippet)
		gci4.insertText = new SnippetString(
			'@Ignore.'
		)
		gci4.kind = CompletionItemKind.Snippet
		gci4.documentation = new MarkdownString(
			'Ignores the test. You can use this annotation when you are still working on a code, the test case is not ready to run, or if the execution time of test is too long to be included.'
		)
		this.globalItems.push(gci4)

		// ---------- class items ---------- //

		let cci = new CompletionItem('@TestSuite')
		cci.insertText = new SnippetString(
			'@TestSuite(classes="${1:procedureList}").'
		)
		cci.documentation = new MarkdownString(
			'Runs a suite of test cases from a specified list.\n' +
			'\n' +
			'* [Test Suite Class](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-developer-studio-help/page/Test-Suite-Class.html') + ')'
		)
		this.globalItems.push(cci)

		cci = new CompletionItem('@Test method', CompletionItemKind.Snippet)
		cci.insertText = new SnippetString(
			'@Test.\n' +
			'method public void ${1:methodName} () :\n' +
			'\t${2://TODO: Implement test method}\n' +
			'end method.'
		)
		cci.documentation = new MarkdownString(
			'* [Test Class](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-developer-studio-help/page/Test-Class.html') + ')'
		)
		this.classItems.push(cci)

		cci = new CompletionItem('@Test method exception')
		cci.documentation = 'Fails the test if the method does not throw the exception mentioned in the expected attribute.'
		cci.insertText = new SnippetString(
			'@Test (expected="${1:ExceptionType}").\n' +
			'method public void testExceptionMethod () :\n' +
			'\t${2:runMethodThrowsException().} //Throws ${1}\n' +
			'end method.'
		)
		this.classItems.push(cci)

		cci = new CompletionItem('@Setup method', CompletionItemKind.Snippet)
		cci.documentation = 'To be deprecated, use @BeforeEach'
		cci.insertText = new SnippetString(
			'@Setup.\n' +
			'method public void beforeEach () :\n' +
			'\t// Executes before each test\n' +
			'\t${1:// do setup here}\n' +
			'end method.'
		)
		this.classItems.push(cci)

		cci = new CompletionItem('@Before method')
		cci.documentation = 'To be deprecated, use @BeforeAll'
		cci.insertText = new SnippetString(
			'@BeforeEach.\n' +
			'method public void beforeEach () :\n' +
			'\t// Executes before each test\n' +
			'\t${1:// do setup here}\n' +
			'end method.'
		)
		this.classItems.push(cci)

		cci = new CompletionItem('@BeforeAll method')
		cci.documentation = 'Executes the procedure once per class, before the start of all tests. This annotation can be used to perform time-sensitive activities such as connecting to a database.'
		cci.insertText = new SnippetString(
			'@BeforeAll.\n' +
			'method public void beforeAll () :\n' +
			'\t// Executes before any test\n' +
			'\t${1:// do setup here}\n' +
			'end method.'
		)
		this.classItems.push(cci)

		cci = new CompletionItem('@BeforeEach method')
		cci.documentation = 'Executes the method before each test. This annotation prepares the test environment such as reading input data or initializing the class.'
		cci.insertText = new SnippetString(
			'@BeforeEach.\n' +
			'method public void beforeEach () :\n' +
			'\t// Executes before each test\n' +
			'\t${1:// do setup here}\n' +
			'end method.'
		)
		this.classItems.push(cci)

		cci = new CompletionItem('@Teardown method')
		cci.documentation = 'To be deprecated, use @AfterEach'
		cci.insertText = new SnippetString(
			'@Teardown.\n' +
			'method public void afterEach () :\n' +
			'\t// Executes after each tests\n' +
			'\t${1:// do some cleanup here}\n' +
			'end method.'
		)
		this.classItems.push(cci)

		cci = new CompletionItem('@After method')
		cci.documentation = 'To be deprecated, use @AfterAll'
		cci.insertText = new SnippetString(
			'@After.\n' +
			'method public void afterAll () :\n' +
			'\t// Executes before after all the tests are executed\n' +
			'end method.'
		)
		this.classItems.push(cci)

		cci = new CompletionItem('@AfterAll method')
		cci.documentation = 'Executes the method once, after all the tests are executed. This annotation is used to perform clean-up activities such as disconnecting from a database.'
		cci.insertText = new SnippetString(
			'@AfterAll.\n' +
			'method public void afterAll() :\n' +
			'\t// Executes once after all tests are executed\n' +
			'end method.'
		)
		this.classItems.push(cci)

		cci = new CompletionItem('@AfterEach method')
		cci.documentation = 'Executes the method after each test. This annotation cleans up the test environment such as deleting temporary data or restoring defaults.'
		cci.insertText = new SnippetString(
			'@AfterEach.\n' +
			'method public void afterEach () :\n' +
			'\t// Executes after each test\n' +
			'end method.'
		)
		this.classItems.push(cci)

		// ---------- procedure items ---------- //

		let pci = new CompletionItem('@TestSuite')
		pci.insertText = new SnippetString(
			'@TestSuite(procedures="${1:procedureList}").'
		)
		pci.documentation = new MarkdownString(
			'Runs a suite of test cases from a specified list.\n' +
			'\n' +
			'* [Test Suite Procedure](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-developer-studio-help/page/Test-Suite-Procedure.html') + ')\n'
		)
		this.globalItems.push(pci)

		pci = new CompletionItem('@Test Procedure', CompletionItemKind.Snippet)
		pci.insertText = new SnippetString('@Test.\nprocedure ${1:procedureName} :\n\t${2://TODO: Implement test procedure}\nend procedure.')
		pci.documentation = new MarkdownString(
			'A procedure that is a test procedure\n' +
			'\n' +
			'* [Test Procedure](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-developer-studio-help/page/Test-Procedure.html') + ')'
		)
		this.procedureItems.push(pci)

		pci = new CompletionItem('@Test procedure exception')
		pci.documentation = new MarkdownString(
			'Fails the test if the procedure does not throw the exception mentioned in the expected attribute.'
		)
		pci.insertText = new SnippetString(
			'@Test (expected="${1:ExceptionType}").\n' +
			'procedure testExceptionProc :\n' +
			'\t${2:runProcThrowsException().} //Throws ${1}\n' +
			'end procedure.'
		)
		this.procedureItems.push(pci)

		pci = new CompletionItem('@Setup procedure', CompletionItemKind.Snippet)
		pci.documentation = 'To be deprecated, use @BeforeAll'
		pci.insertText = new SnippetString(
			'@Setup.\n' +
			'procedure beforeAll :\n' +
			'\t// Executes before each test\n' +
			'\t${1:// do setup here}\n' +
			'end procedure.'
		)
		this.procedureItems.push(pci)

		pci = new CompletionItem('@Before procedure')
		pci.documentation = 'To be deprecated, use @BeforeEach'
		pci.insertText = new SnippetString(
			'@Before.\n' +
			'procedure beforeEach :\n' +
			'\t// Executes once per program before the start of all tests\n' +
			'\t${1:// do setup here}\n' +
			'end procedure.'
		)
		this.procedureItems.push(pci)

		pci = new CompletionItem('@BeforeAll procedure')
		pci.documentation = 'Executes the procedure once per program, before the start of all tests. This annotation can be used to perform time-sensitive activities such as connecting to a database.'
		pci.insertText = new SnippetString(
			'@BeforeAll.\n' +
			'procedure beforeAll :\n' +
			'\t// Executes before each test\n' +
			'\t${1:// do setup here}\n' +
			'end procedure.'
		)
		this.procedureItems.push(pci)

		pci = new CompletionItem('@BeforeEach procedure')
		pci.documentation = 'Executes the procedure after each test. This annotation cleans up the test environment such as deleting temporary data or restoring defaults.'
		pci.insertText = new SnippetString(
			'@BeforeEach.\n' +
			'procedure beforeEach :\n' +
			'\t// Executes once per program before the start of all tests\n' +
			'\t${1:// do setup here}\n' +
			'end procedure.'
		)
		this.procedureItems.push(pci)

		pci = new CompletionItem('@Teardown procedure')
		pci.documentation = 'To be deprecated, use @AfterEach'
		pci.insertText = new SnippetString(
			'@TearDown.\n' +
			'procedure afterEach :\n' +
			'\t// Executes after each test\n' +
			'\t${1:// do some cleanup here}\n' +
			'end procedure'
		)
		this.procedureItems.push(pci)

		pci = new CompletionItem('@After procedure')
		pci.documentation = 'To be deprecated, use @AfterAll'
		pci.insertText = new SnippetString(
			'@After.\n' +
			'procedure afterAll :\n' +
			'\t// Executes once after all the tests are executed\n' +
			'end procedure.'
		)
		this.procedureItems.push(pci)

		pci = new CompletionItem('@AfterAll procedure')
		pci.documentation = 'Executes the procedure once, after all the tests are executed. This annotation is used to perform clean-up activities such as disconnecting from a database.'
		pci.insertText = new SnippetString(
			'@AfterAll.\n' +
			'procedure afterAll :\n' +
			'\t// Executes once after all the tests are executed\n' +
			'end procedure.'
		)
		this.procedureItems.push(pci)

		pci = new CompletionItem('@AfterEach procedure')
		pci.documentation = 'Executes the procedure after each test. This annotation cleans up the test environment such as deleting temporary data or restoring defaults.'
		pci.insertText = new SnippetString(
			'@AfterEach.\n' +
			'procedure afterEach :\n' +
			'\t// Executes after each test\n' +
			'\t${1:// do some cleanup here}\n' +
			'end procedure.'
		)
		this.procedureItems.push(pci)

		for (const i of this.classItems) {
			i.kind = CompletionItemKind.Method
		}
		for (const i of this.procedureItems) {
			i.kind = CompletionItemKind.Function
		}

		const allItems = [...this.globalItems, ...this.classItems, ...this.procedureItems]
		for (const i of allItems) {

			let lbl = ''
			if (typeof i.label == 'string') {
				lbl = i.label
			} else {
				lbl = i.label.label
			}
			log.info('lbl=' + lbl)
			if (lbl.startsWith('@')) {
				i.detail = 'ablunit annotation'
				if (typeof i.documentation == 'string') {
					i.documentation = new MarkdownString(i.documentation)
				} else if (!i.documentation) {
					i.documentation = new MarkdownString()
				}
				if (!i.documentation.value.endsWith('\n') && i.documentation.value.length != 0) {
					i.documentation.appendMarkdown('\n')
				}
				i.documentation.appendMarkdown('* [Annotations supported by ABLUnit](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-developer-studio-help/page/Annotations-supported-with-ABLUnit.html') + ')')
				if (lbl.startsWith('@Before') || lbl.startsWith('@After') || lbl.startsWith('@Setup') || lbl.startsWith('@Teardown')) {
					i.documentation.appendMarkdown('\n* [Lifecycle of ABLUnit framework](https://docs.progress.com/bundle/openedge-developer-studio-help/page/Lifecycle-of-ABLUnit-framework.html)')
				}
			}

			if (this.oeVersion >= '12.6') {
				if (lbl.startsWith('@Before ') || lbl.startsWith('@After ') || lbl.startsWith('@Teardown') || lbl.startsWith('@Setup')) {
					i.tags = [CompletionItemTag.Deprecated]
				}
			}
		}

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
				log.info('i.label(1)=' + i.label)
				i.label = i.label.replace(/\$\{\d:input\}/g, 'param')
				log.info('i.label(2)=' + i.label)
			}
			i.documentation = new MarkdownString(
				'* [OpenEdge.Core.Assert](' + this.urlForVersion('https://docs.progress.com/bundle/openedge-abl-api-reference-128/page/OpenEdge.Core.Assert.html') + ')'
			)
		}
		return items
	}

	provideCompletionItems (document: TextDocument, pos: Position, _token: CancellationToken, _context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList> {
		log.info('provideCompletionItems document.uri=' + document.uri.fsPath)
		log.info('completionContext=' + JSON.stringify(_context))
		log.info('pos=' + JSON.stringify(pos))

		if (document.languageId != 'abl') {
			return undefined
		}

		// OpenEdge.Core.Assert <-> Assert
		let searchVal = 'Assert:'
		let replaceVal = 'OpenEdge.Core.Assert:'
		if (document.getText().toLowerCase().includes('using openedge.core.assert.')) {
			searchVal = 'OpenEdge.Core.Assert:'
			replaceVal = 'Assert:'
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

		const using = this.globalItems.find(i => i.label == 'using OpenEdge.Core.Assert.')
		if (!using) {
			log.info('unable to find CompletionItem for "using OpenEdge.Core.Assert."')
			throw new Error('unable to find CompletionItem for "using OpenEdge.Core.Assert."')
		}
		log.info('USING=' + JSON.stringify(using))
		const docText = document.getText()
		let idx = docText.indexOf('OpenEdge.Core.Assert:')
		using.additionalTextEdits = []
		while (idx >= 0) {
			const posEdit = document.positionAt(idx)
			log.info('posEdit=' + JSON.stringify(posEdit))
			using.additionalTextEdits.push(new TextEdit(
				new Range(posEdit, posEdit.translate(0, 'OpenEdge.Core.Assert:'.length)),
				'Assert:')
			)
			idx = docText.indexOf('OpenEdge.Core.Assert:', idx + 1)
		}
		log.info('using.additionalTextEdits.length=' + using.additionalTextEdits?.length)



		const endOfLine = document.positionAt(document.offsetAt(pos.with(pos.line + 1, 0)) - 1)
		log.info('endOfLine=' + JSON.stringify(endOfLine))
		const wordBefore = document.getText(new Range(pos.with(pos.line, 0), pos)).split(/\s/).pop() ?? ''
		const wordAfter = document.getText(new Range(pos, endOfLine)).split(/\s/)[0] ?? ''

		log.info('text.raw="' + wordBefore + wordAfter + '"')
		log.info('  before=' + wordBefore)
		log.info('   after=' + wordAfter)

		const ret = new CompletionList()
		ret.items.push(...this.globalItems)
		if (document.uri.fsPath.endsWith('.cls')) {
			ret.items.push(...this.classItems)
		} else if (document.uri.fsPath.endsWith('.p')) {
			ret.items.push(...this.procedureItems)
		}
		for (const r of ret.items) {
			r.range = undefined
			log.info('additionalEdits.length=' + r.additionalTextEdits?.length)
			for (const e of r.additionalTextEdits ?? []) {
				log.info('additionalEdit=' + JSON.stringify(e))
			}
		}

		if (wordBefore != '') {

			for (const r of ret.items) {
				let lbl
				if (typeof r.label == 'string') {
					lbl = r.label
				} else {
					lbl = r.label.label
				}
				if (!lbl.startsWith('@') && !lbl.startsWith('Assert:') && !lbl.startsWith('OpenEdge.Core.Assert:')) {
					continue
				}

				log.info('lbl=' + lbl)
				log.info('r.range(1)=' + JSON.stringify(r.range))
				if (!r.range) {
					let posEnd
					if ((lbl.startsWith('Assert:') || lbl.startsWith('OpenEdge.Core.Assert:')) && wordAfter.indexOf('(') > 0) {
						posEnd = pos.translate(0, wordAfter.indexOf('('))
					} else {
						posEnd = pos.translate(0, wordAfter.length)
					}
					r.range = new Range(
						pos.translate(0, 0 - wordBefore.length),
						posEnd
					)
					const word = document.getText(r.range)
					log.info('r.range(2)=' + JSON.stringify(r.range) + ', word=' + word)
				}
			}
		}


		log.info('return ret.length=' + ret.items.length)
		return ret
	}

	_resolveCompletionItem (item: CompletionItem, _token: CancellationToken): ProviderResult<CompletionItem> {
		log.info('resolve item=' + JSON.stringify(item, null, 2))
		log.info('resolve range=' + JSON.stringify(item.range))
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
}


export class InlineProvider extends SnippetProvider implements InlineCompletionItemProvider  {

	async provideInlineCompletionItems (document: TextDocument, position: Position, _context: InlineCompletionContext, token: CancellationToken) {
		log.info('context=' + JSON.stringify(context))
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
