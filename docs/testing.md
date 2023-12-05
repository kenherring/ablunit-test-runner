# Testing

## Install and Run

```
## Step 1: Package
vsce package --pre-release --githubBranch "$(git branch --show-current)"

## Step 2: Run the installAndRun test
cd dummy-ext
npm run test:install-and-run
```
