import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaSignOutAlt, FaList, FaWrench, FaCog, FaBars, FaTimes } from 'react-icons/fa';

function Sidebar({ user, onLogout }) {
  const location = useLocation();
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);

  const handleLogout = () => {
    onLogout();
    setIsSidebarOpenMobile(false);
  };

  const isActive = (path) => location.pathname === path || (path === '/category' && location.pathname === '/');

  return (
    <>
      <button
        className="md:hidden fixed top-4 left-4 z-[1000] p-2 rounded-full bg-blue-600 shadow-lg text-white hover:bg-blue-700 transition-all duration-200 transform hover:scale-105"
        onClick={() => setIsSidebarOpenMobile(!isSidebarOpenMobile)}
        aria-label={isSidebarOpenMobile ? "Đóng menu" : "Mở menu"}
      >
        {isSidebarOpenMobile ? <FaTimes size={20} /> : <FaBars size={20} />}
      </button>

      <div
        className={`sidebar fixed inset-y-0 left-0 z-[900] w-64 bg-gradient-to-b from-blue-800 to-blue-600 text-white shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isSidebarOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 flex flex-col rounded-r-xl`}
      >
        <div className="flex items-center justify-center p-6 border-b border-blue-700">
          <Link to="/category" className="flex items-center gap-3" onClick={() => setIsSidebarOpenMobile(false)}>
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md transform hover:scale-105 transition-transform duration-200">
              <span className="text-blue-600 text-xl font-bold">WC</span>
            </div>
            <h2 className="text-lg font-semibold text-white">Water Company</h2>
          </Link>
        </div>

        <nav className="flex-grow p-3 space-y-2 overflow-y-auto custom-scrollbar">
          <Link
            to="/category"
            className={`flex items-center py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 hover:bg-blue-700 hover:shadow-md ${
              isActive('/category') ? 'bg-blue-700 text-white shadow-md' : 'text-white'
            }`}
            onClick={() => setIsSidebarOpenMobile(false)}
          >
            <FaList className="mr-3" size={18} />
            Công trình danh mục
          </Link>
          <Link
            to="/minor-repair"
            className={`flex items-center py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 hover:bg-blue-700 hover:shadow-md ${
              isActive('/minor-repair') ? 'bg-blue-700 text-white shadow-md' : 'text-white'
            }`}
            onClick={() => setIsSidebarOpenMobile(false)}
          >
            <FaWrench className="mr-3" size={18} />
            Sửa chữa nhỏ
          </Link>
          {user?.permissions?.approve && (
            <Link
              to="/settings"
              className={`flex items-center py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 hover:bg-blue-700 hover:shadow-md ${
                isActive('/settings') ? 'bg-blue-700 text-white shadow-md' : 'text-white'
              }`}
              onClick={() => setIsSidebarOpenMobile(false)}
            >
              <FaCog className="mr-3" size={18} />
              Thiết lập
            </Link>
          )}
        </nav>

        <div className="p-3 border-t border-blue-700">
          <button
            onClick={handleLogout}
            className="flex items-center py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 hover:bg-red-600 hover:shadow-md w-full text-left text-white"
          >
            <FaSignOutAlt className="mr-3" size={18} />
            Đăng xuất
          </button>
        </div>
      </div>

      {isSidebarOpenMobile && (
        <div
          className="md:hidden fixed inset-0 bg-black opacity-70 z-[800]"
          onClick={() => setIsSidebarOpenMobile(false)}
        ></div>
      )}
    </>
  );
}

export default Sidebar;