interface NavbarProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  title?: string;
  onGoHome?: () => void;
}

export default function Navbar({ darkMode, toggleDarkMode, onGoHome }: NavbarProps) {
  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <button
            onClick={onGoHome}
            className="text-xl font-bold text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity flex items-center gap-1.5"
            title="Về trang chủ"
          >
            <span>QZ</span>
          </button>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            title={darkMode ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </nav>
  );
}
