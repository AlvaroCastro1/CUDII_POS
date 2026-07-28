import { create } from 'zustand';

interface ThemeState {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
}

// Sincronizar el estado inicial con Tailwind (leer del localStorage o preferencia del sistema)
const initialTheme = localStorage.getItem('cudii_theme');
const isDark = initialTheme === 'dark' || (!initialTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);

export const useThemeStore = create<ThemeState>((set) => ({
  isDarkMode: isDark,
  
  toggleDarkMode: () => set((state) => {
    const newVal = !state.isDarkMode;
    if (newVal) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('cudii_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('cudii_theme', 'light');
    }
    return { isDarkMode: newVal };
  }),
  
  setDarkMode: (value) => set(() => {
    if (value) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('cudii_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('cudii_theme', 'light');
    }
    return { isDarkMode: value };
  }),
}));
