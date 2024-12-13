import stylistic from "@stylistic/eslint-plugin";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import promise from "eslint-plugin-promise";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: ["**/dummy-ext/", "**/test_projects/", "**/esbuild.js"],
}, ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "plugin:promise/recommended",
), {
    plugins: {
        "@stylistic": stylistic,
        "@typescript-eslint": typescriptEslint,
        promise,
    },

    languageOptions: {
        globals: {
            Atomics: "readonly",
            SharedArrayBuffer: "readonly",
        },

        parser: tsParser,
        ecmaVersion: 5,
        sourceType: "script",

        parserOptions: {
            project: "./tsconfig.json",
            tsconfigRootDir: ".",
        },
    },

    rules: {
        "@stylistic/indent": ["error", "tab"],

        "@stylistic/comma-spacing": ["warn", {
            before: false,
            after: true,
        }],

        "@stylistic/no-extra-parens": "warn",

        "@typescript-eslint/no-restricted-types": ["error", {
            types: {
                Object: "Use {} instead.",
                String: "Use 'string' instead.",
                Number: "Use 'number' instead.",
                Boolean: "Use 'boolean' instead.",
            },
        }],

        "@typescript-eslint/naming-convention": ["error", {
            selector: "interface",
            format: ["PascalCase"],

            custom: {
                regex: "^I[A-Z]",
                match: true,
            },
        }],

        "@typescript-eslint/no-confusing-non-null-assertion": "warn",

        "@typescript-eslint/no-floating-promises": ["error", {
            checkThenables: true,
        }],

        "@typescript-eslint/no-misused-promises": "error",
        "@typescript-eslint/no-non-null-assertion": 0,
        "@typescript-eslint/no-unnecessary-condition": 0,
        "no-unused-vars": "off",

        "@typescript-eslint/no-unused-vars": ["warn", {
            argsIgnorePattern: "^_",
            vars: "all",
            args: "none",
            ignoreRestSiblings: false,
        }],

        "@typescript-eslint/prefer-readonly": "warn",
        "@typescript-eslint/restrict-plus-operands": "off",
        "@typescript-eslint/switch-exhaustiveness-check": "warn",
        "promise/catch-or-return": "warn",
        "promise/no-callback-in-promise": "off",

        "promise/always-return": ["warn", {
            ignoreLastCallback: true,
        }],

        "no-console": "warn",
        "no-empty": "warn",
        "no-mixed-spaces-and-tabs": ["error", "smart-tabs"],

        "no-trailing-spaces": ["error", {
            skipBlankLines: false,
        }],

        "prefer-promise-reject-errors": "error",
        quotes: ["warn", "single"],
        semi: ["error", "never"],
        "space-before-blocks": ["error", "always"],
        "space-before-function-paren": ["warn", "always"],
        "space-in-parens": ["warn", "never"],

        "spaced-comment": ["error", "always", {
            markers: ["/"],
        }],
    },
}];