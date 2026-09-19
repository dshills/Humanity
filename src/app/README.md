# src/app: the parts of HT.app

`HT.app` is one closure: its rendering, interaction and URL code share a few dozen state variables (`view`,
`shown`, `dom`, `size`, `selected` and so on), and keeping them in one scope is what keeps the code simple. At
3,000 lines one file had stopped being pleasant, so it is cut into the files here by topic.

`build.mjs` joins them in name order and wraps the result:

```js
(function (root) {
  'use strict';
  /* 00-state.js, 10-helpers.js, ... 90-init.js */
})(typeof window !== 'undefined' ? window : globalThis);
```

So every part is a plain script of top-level declarations that may use anything declared in any other part.
Each file parses on its own (`node --check src/app/*.js`), which the build verifies, but none of them runs on its
own. Rules:

- `const` and `let` state lives in `00-state.js`; declare new shared state there, because a `const` is not
  visible to code that runs before its declaration, and `90-init.js` runs last.
- The numeric prefixes set the order and leave gaps for new files. Function declarations are hoisted across the
  whole closure, so parts can call each other freely.
- Anything that can be written without the DOM, storage, the network or a clock belongs in `src/core.js`, where
  it can be unit-tested. What is left here is exercised by `e2e/smoke.mjs`.
