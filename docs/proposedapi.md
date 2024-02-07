# Proposed API

## Create `package.json`

```bash
jq.exe '. += {"enabledApiProposals": ["testCoverage"]}' package.stable.json > package.proposedapi.json
```
