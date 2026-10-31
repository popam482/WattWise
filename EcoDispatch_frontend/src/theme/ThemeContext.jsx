import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext({
    theme: 'dark',
    isDark: true,
    toggleTheme: () => {},
    setTheme: () => {}
});

const STORAGE_KEY = 'wattwise_theme';

function applyThemeClass(theme) {
    const root = document.documentElement;
    const body = document.body;

    if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        root.classList.add('bg-slate-950');
        root.classList.remove('bg-slate-50');
        body.classList.add('bg-slate-950', 'text-slate-100');
        body.classList.remove('bg-slate-50', 'text-slate-900');
    } else {
        root.classList.remove('dark');
        root.classList.add('light');
        root.classList.add('bg-emerald-50');
        root.classList.remove('bg-slate-950');
        body.classList.add('bg-emerald-50', 'text-slate-900');
        body.classList.remove('bg-slate-950', 'text-slate-100');
    }
}

export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'light' || saved === 'dark') return saved;
        } catch {
            /* ignore */
        }
        return 'dark';
    });

    useEffect(() => {
        applyThemeClass(theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            /* ignore */
        }
    }, [theme]);

    const setTheme = useCallback((next) => {
        setThemeState(next === 'light' ? 'light' : 'dark');
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
    }, []);

    const value = useMemo(
        () => ({
            theme,
            isDark: theme === 'dark',
            toggleTheme,
            setTheme
        }),
        [theme, toggleTheme, setTheme]
    );

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}

export default ThemeContext;
