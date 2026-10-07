// The theme layer: import once at the app entry. Components only ever read
// the tokens defined in tokens.css.
import '@fontsource-variable/schibsted-grotesk/wght.css';
import './tokens.css';
import './base.css';

export {
  DEFAULT_APPEARANCE,
  applyAppearance,
  initAppearance,
  isAppearance,
  isDark,
  loadAppearance,
  setAppearance,
  useAppearance,
  useIsDark,
  type Appearance,
  type Density,
  type MotionPref,
  type ThemePref,
} from './appearance';
