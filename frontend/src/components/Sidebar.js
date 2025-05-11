// frontend/src/components/Sidebar.js
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaSignOutAlt, FaList, FaWrench, FaCog, FaBars, FaTimes } from 'react-icons/fa';

function Sidebar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);

  const handleLogout = () => {
    onLogout();
  };

  const isActive = (path) => location.pathname === path;

  const linkClasses = "flex items-center py-2.5 px-4 rounded-lg hover:bg-blue-600 transition-all duration-200 text-sm font-medium";
  const activeLinkClasses = "bg-blue-600 text-white";

  return (
    <>
      {/* Nút Hamburger để mở sidebar trên mobile */}
      <button
        className="md:hidden fixed top-3 left-3 z-50 text-gray-600 bg-white p-2 rounded-md shadow hover:bg-gray-100"
        onClick={() => setIsSidebarOpenMobile(!isSidebarOpenMobile)}
        aria-label={isSidebarOpenMobile ? "Đóng menu" : "Mở menu"}
      >
        {isSidebarOpenMobile ? <FaTimes size={20} /> : <FaBars size={20} />}
      </button>

      {/* Sidebar */}
      <div
        className={`
          sidebar fixed inset-y-0 left-0 z-40
          w-64 bg-gradient-to-b from-blue-800 to-blue-900 text-white
          shadow-xl transition-transform duration-300 ease-in-out
          transform ${isSidebarOpenMobile ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
          flex flex-col pt-16 md:pt-0
        `}
      >
        {/* Header của Sidebar */}
        <div className="hidden md:flex items-center justify-center p-5 border-b border-blue-700 h-16">
          <Link to="/category" className="flex items-center" onClick={() => setIsSidebarOpenMobile(false)}>
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center mr-2 shadow">
              <span className="text-blue-800 text-xl font-bold">WC</span>
            </div>
            <h2 className="text-lg font-semibold">Water Company</h2>
          </Link>
        </div>

        <nav className="flex-grow p-3 space-y-2 overflow-y-auto">
          <Link
            to="/category"
            className={`${linkClasses} ${isActive('/category') || isActive('/') ? activeLinkClasses : 'hover:text-blue-200'}`}
            onClick={() => setIsSidebarOpenMobile(false)}
          >
            <FaList className="mr-3 flex-shrink-0" />
            Công trình danh mục
          </Link>
          <Link
            to="/minor-repair"
            className={`${linkClasses} ${isActive('/minor-repair') ? activeLinkClasses : 'hover:text-blue-200'}`}
            onClick={() => setIsSidebarOpenMobile(false)}
          >
            <FaWrench className="mr-3 flex-shrink-0" />
            Sửa chữa nhỏ
          </Link>
          {user?.permissions?.approve && (
            <Link
              to="/settings"
              className={`${linkClasses} ${isActive('/settings') ? activeLinkClasses : 'hover:text-blue-200'}`}
              onClick={() => setIsSidebarOpenMobile(false)}
            >
              <FaCog className="mr-3 flex-shrink-0" />
              Thiết lập
            </Link>
          )}
        </nav>

        <div className="p-3 mt-auto border-t border-blue-700">
          <button
            onClick={() => {
              handleLogout();
              setIsSidebarOpenMobile(false);
            }}
            className={`${linkClasses} w-full text-left hover:text-red-300`}
          >
            <FaSignOutAlt className="mr-3 flex-shrink-0" />
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Overlay khi sidebar mở trên mobile */}
      {isSidebarOpenMobile && (
        <div
          className="md:hidden fixed inset-0 bg-black opacity-50 z-30"
          onClick={() => setIsSidebarOpenMobile(false)}
        ></div>
      )}
    </>
  );
}

export default Sidebar;