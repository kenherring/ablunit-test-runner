# Insiders Build

## Setup

```
npx @vscode/dts dev
```

## Updating the insiders branch

```bash
git fetch origin
git checkout insiders
git reset --hard origin/insiders
git clean -fdx

git rebase origin/main
# git rebase --stratgey theirs origin/main
# git rebase --reapply-cherry-pick --stratgey theirs origin/main

## fix up
npm uninstall @types/vscode
node ./src/test/createTestConfig.ts

git rebase --continue
git checkout -b rebase-insiders
git push

```


## Todo / Notes

<!-- none -->
