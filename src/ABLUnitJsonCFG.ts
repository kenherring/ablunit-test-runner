interface options {
	output: {
		location: string
		format: "xml"
	},
	quitOnEnd: boolean
	writeLog: boolean
	showErrorMessage: boolean
	throwError: boolean
	tests?: [
		{
			test: string,
			cases?: [
				string
			]
		} |
		{
			folder: string
		}
	]
}
