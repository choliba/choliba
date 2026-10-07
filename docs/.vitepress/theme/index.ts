import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';

import './custom.css';

/** The default theme, in the colors of the choliba owl (`custom.css`). The home is `docs/index.md`. */
export default { extends: DefaultTheme } satisfies Theme;
