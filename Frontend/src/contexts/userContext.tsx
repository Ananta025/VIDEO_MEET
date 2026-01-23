import React, { createContext, useState, useEffect } from 'react';
import { User, UserContextType, UserProviderProps } from '@/types';

// Create the context with default values
export const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
});

export const UserProvider = ({ children }: UserProviderProps) => {
  const [user, setUser] = useState<User>(() => {
    // Try to load user from localStorage on initial render
    const savedUser = localStorage.getItem('userData');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {

        // localStorage.removeItem('userData');
        return null;
      }
    }
    return null;
  });
  
  // Persist user data to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('userData', JSON.stringify(user));
    } else {
      localStorage.removeItem('userData');
    }
  }, [user]);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

// Add this to your userContext.tsx file
export const useUser = () => {
    const context = React.useContext(UserContext);
    if (context === undefined) {
      throw new Error('useUser must be used within a UserProvider');
    }
    return context;
  };