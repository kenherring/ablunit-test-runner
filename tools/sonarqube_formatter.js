// This file borrowed from the following article
// https://medium.com/@jose_82797/how-to-import-eslint-issues-into-sonarqube-overview-analysis-in-a-frontend-application-b8e8946b8104

module.exports = function(results) {
    let summary = {issues: []};
    results.forEach(function(result) {
        result.messages.forEach(function(msg) {
            let logMessage = {
                engineId: "eslint",
                ruleId: msg.ruleId,
                primaryLocation: {
                    message: msg.message,
                    filePath: result.filePath,
                    textRange: {
                        startLine: msg.line,
                        endLine: msg.endLine,
                        endColumn: msg.endColumn
                    }
                }
            };

            // The log message type and severity is up to you but you need to take in consideration SonarQube properties
            if (msg.severity === 1) {
                logMessage.type = "CODE_SMELL";
                logMessage.severity = "INFO";
            }
            if (msg.severity === 2) {
                logMessage.type = "BUG";
                logMessage.severity="MAJOR";
            }
            summary.issues.push(logMessage);
        });
    });
    return JSON.stringify(summary);
}
