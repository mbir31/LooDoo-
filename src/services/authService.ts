import {
  signInAnonymously,
  signInWithPopup,
  signOut as fbSignOut,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import { UserProfile, Language } from '../types';

export const AVATAR_OPTIONS = [
  '🦁', '🐯', '🦅', '👑', '🚀', '🔥', '⚡', '🌟',
  '🎲', '🎯', '🏆', '💎', '🦄', '🐼', '🦊', '🐉',
  '⚔️', '🎭', '🛡️', '🍀', '💥', '💫', '👾', '🤖'
];

export const DEFAULT_NAMES = [
  'Birshreshtha', 'Shakib', 'Tamim', 'Ronaldo', 'Messi', 'Hero', 'Tiger', 'Challenger', 'Master', 'Champion'
];

export function getRandomDefaultName(): string {
  const name = DEFAULT_NAMES[Math.floor(Math.random() * DEFAULT_NAMES.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${name}${num}`;
}

export function getRandomAvatar(): string {
  return AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)];
}

const LOCAL_STORAGE_KEY = 'loodoo_user_profile';

/**
 * Gets or creates a local guest profile stored in localStorage
 */
export function getLocalGuestProfile(): UserProfile {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.uid) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read cached profile:', e);
  }

  // Generate fresh unique guest profile
  const guestId = 'guest_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  const newProfile: UserProfile = {
    uid: guestId,
    displayName: getRandomDefaultName(),
    preferredLanguage: 'bn',
    avatar: getRandomAvatar(),
    activeRoomId: null,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    isAnonymous: true,
    email: null,
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newProfile));
  } catch (e) {
    // Ignore storage write errors
  }

  return newProfile;
}

/**
 * Initializes or fetches the user profile document in Firestore
 */
export async function getOrCreateUserProfile(user: User): Promise<UserProfile> {
  const local = getLocalGuestProfile();
  const userRef = doc(db, 'users', user.uid);

  try {
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      const profile: UserProfile = {
        uid: user.uid,
        displayName: data.displayName || user.displayName || local.displayName || getRandomDefaultName(),
        preferredLanguage: (data.preferredLanguage as Language) || local.preferredLanguage || 'bn',
        avatar: data.avatar || local.avatar || getRandomAvatar(),
        activeRoomId: data.activeRoomId || null,
        createdAt: data.createdAt || Date.now(),
        lastSeenAt: Date.now(),
        isAnonymous: user.isAnonymous,
        email: user.email || null,
      };

      updateDoc(userRef, { lastSeenAt: Date.now() }).catch(() => {});
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
      } catch (_) {}
      return profile;
    }

    // Create new profile doc
    const newProfile: UserProfile = {
      uid: user.uid,
      displayName: user.displayName || local.displayName || getRandomDefaultName(),
      preferredLanguage: local.preferredLanguage || 'bn',
      avatar: local.avatar || getRandomAvatar(),
      activeRoomId: null,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      isAnonymous: user.isAnonymous,
      email: user.email || null,
    };

    await setDoc(userRef, {
      ...newProfile,
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newProfile));
    } catch (_) {}

    return newProfile;
  } catch (e) {
    console.warn('Firestore user profile fetch notice:', e);
    return {
      uid: user.uid,
      displayName: user.displayName || local.displayName || getRandomDefaultName(),
      preferredLanguage: local.preferredLanguage || 'bn',
      avatar: local.avatar || getRandomAvatar(),
      activeRoomId: null,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      isAnonymous: user.isAnonymous,
      email: user.email || null,
    };
  }
}

/**
 * Automatic seamless authentication: verifies persistent user session or logs in anonymously
 */
export async function loginAsGuest(): Promise<User | null> {
  try {
    if (auth.currentUser) {
      return auth.currentUser;
    }
    const credential = await signInAnonymously(auth);
    return credential.user;
  } catch (error: any) {
    // If anonymous login is already in progress or completed
    if (auth.currentUser) {
      return auth.currentUser;
    }
    console.debug('Guest login notice:', error?.message || error);
    return null;
  }
}

/**
 * Ensures user is authenticated seamlessly without requiring developer approvals
 */
export async function ensurePersistentAuth(): Promise<UserProfile> {
  const local = getLocalGuestProfile();
  try {
    if (auth.currentUser) {
      return await getOrCreateUserProfile(auth.currentUser);
    }
    const user = await loginAsGuest();
    if (user) {
      return await getOrCreateUserProfile(user);
    }
  } catch (e) {
    console.debug('Persistent auth verify notice:', e);
  }
  return local;
}

/**
 * Optional Login with Google
 */
export async function loginWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

/**
 * Sign out
 */
export async function logoutUser(): Promise<void> {
  try {
    await fbSignOut(auth);
  } catch (_) {}
}

/**
 * Update user display name, avatar, preferences, and stats
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> {
  try {
    const local = getLocalGuestProfile();
    const merged = { ...local, ...updates, uid };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
  } catch (_) {}

  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...updates,
      lastSeenAt: Date.now(),
    });
  } catch (_) {
    // Guest or offline Firestore write notice
  }
}
