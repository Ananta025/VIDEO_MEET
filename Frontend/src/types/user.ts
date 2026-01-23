/**
 * User-related type definitions
 */

/**
 * Base User type - represents a user in the system
 */
export type User = {
  id?: string;
  name?: string;
  email?: string;
  token?: string;
} | null;

/**
 * User context type for React context
 */
export type UserContextType = {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User>>;
};

/**
 * Props for UserProvider component
 */
export type UserProviderProps = {
  children: React.ReactNode;
};

/**
 * Login request payload
 */
export interface LoginPayload {
  email: string;
  password: string;
}

/**
 * Register request payload
 */
export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

/**
 * User data stored in localStorage
 */
export interface StoredUserData {
  id: string;
  name: string;
  email: string;
  token: string;
}
