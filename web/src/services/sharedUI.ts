// UI state bags that more than one screen reads — each one's key, shape and defaults, so every reader
// agrees on them. (Bags private to a single screen are declared next to that screen.)
import { setUI } from './store';

/** The account menu and the bell's notifications panel. Every route change closes both (see App.tsx). */
export const MENU_KEY = 'app-nav';
export interface MenuUI {
  menuOpen: boolean;
  notificationsOpen: boolean;
}
export const MENU_DEFAULTS: MenuUI = { menuOpen: false, notificationsOpen: false };

/**
 * The company's cover/logo pictures and the post pending deletion. Shared by the company profile, its
 * edit screen and the account avatar in the navigation, exactly like the legacy 'company-profile' bag.
 */
export const COMPANY_PROFILE_KEY = 'company-profile';
export interface CompanyProfileUI {
  capa: string | null;
  logo: string | null;
  deleteId: string | null;
}
export const COMPANY_PROFILE_DEFAULTS: CompanyProfileUI = { capa: null, logo: null, deleteId: null };

/** The worker's cover picture: picked on the edit screen, shown on the profile. */
export const WORKER_PHOTO_KEY = 'worker-profile-photo';
export interface WorkerPhotoUI {
  photo: string | null;
}
export const WORKER_PHOTO_DEFAULTS: WorkerPhotoUI = { photo: null };

/** The "Sair da conta?" dialog (components/SignOutDialog.tsx), opened from the menu and Configurações. */
export const SIGN_OUT_KEY = 'sign-out';
export interface SignOutUI {
  open: boolean;
  busy: boolean;
  error: string | null;
}
export const SIGN_OUT_DEFAULTS: SignOutUI = { open: false, busy: false, error: null };
export const askSignOut = () => setUI<SignOutUI>(SIGN_OUT_KEY, { open: true, busy: false, error: null });
