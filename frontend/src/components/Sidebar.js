import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaSignOutAlt, FaList, FaWrench, FaCog, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import logo from '../assets/logo.png'; // Import logo từ thư mục assets

function Sidebar({ user, onLogout, isSidebarOpen, setIsSidebarOpen }) {
  const location = useLocation();
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false); // Trạng thái cho thiết bị di động

  const handleLogout = () => {
    onLogout();
    setIsSidebarOpenMobile(false);
  };

  const isActive = (path) => location.pathname === path || (path === '/category' && location.pathname === '/');

  // Class để điều khiển chiều rộng Sidebar
  const sidebarClass = `sidebar fixed inset-y-0 left-0 z-[900] ${
    isSidebarOpen ? 'w-64' : 'w-16'
  } bg-gradient-to-b from-blue-800 to-blue-600 text-white shadow-2xl transform transition-all duration-300 ease-in-out flex flex-col overflow-x-hidden overflow-y-hidden`;

  // Kích thước icon động dựa trên trạng thái Sidebar
  const iconSize = isSidebarOpen ? 18 : 56; // To hơn khi thu gọn (size-56)

  // Khoảng cách giữa các icon động dựa trên trạng thái Sidebar
  const spaceBetweenIcons = isSidebarOpen ? 'space-y-2' : 'space-y-4';

  // Padding của các nút chức năng động dựa trên trạng thái Sidebar
  const buttonPadding = isSidebarOpen ? 'py-3 px-4' : 'py-2 px-2';

  return (
    <>
      {/* Nút toggle cho thiết bị di động (dưới md) */}
      <button
        className="md:hidden fixed top-4 left-4 z-[1000] p-2 rounded-full bg-blue-600 shadow-lg text-white hover:bg-blue-700 transition-all duration-200 transform hover:scale-105"
        onClick={() => {
          setIsSidebarOpenMobile(!isSidebarOpenMobile);
          setIsSidebarOpen(!isSidebarOpen); // Đồng bộ trạng thái
        }}
        aria-label={isSidebarOpenMobile ? "Đóng menu" : "Mở menu"}
      >
        {isSidebarOpenMobile ? <FaArrowLeft size={20} /> : <FaArrowRight size={20} />}
      </button>

      {/* Sidebar */}
      <div className={sidebarClass}>
        <div className="flex flex-col pt-2 pl-2 pb-6 pr-4 border-b border-blue-700 overflow-x-hidden overflow-y-hidden">
          {/* Nút toggle cho màn hình lớn (md trở lên) */}
          <button
            className="hidden md:block self-start p-2 rounded-full bg-blue-700 text-white hover:bg-blue-800 transition-all duration-200 transform hover:scale-105"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label={isSidebarOpen ? "Thu gọn Sidebar" : "Mở rộng Sidebar"}
          >
            {isSidebarOpen ? <FaArrowLeft size={16} /> : <FaArrowRight size={16} />}
          </button>

          {/* Logo và tiêu đề */}
          <Link to="/category" className="flex flex-col items-center mt-0" onClick={() => setIsSidebarOpenMobile(false)}>
            <div className="bg-white p-1">
              <img
                src={logo} // Sử dụng logo đã import
                alt="Logo Công ty"
                className={`${isSidebarOpen ? 'w-24 h-24' : 'w-24 h-24'} transform hover:scale-105 transition-transform duration-200`} // Logo to (96px x 96px), hình vuông
              />
            </div>
            <h2 className={`text-base font-semibold text-white mt-2 text-center transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
              LAWASUCO
            </h2>
          </Link>
        </div>

        <div className="flex flex-col h-full">
          <nav className={`pt-8 px-3 pb-3 ${spaceBetweenIcons} overflow-x-hidden overflow-y-hidden`}>
            <Link
              to="/category"
              className={`flex items-center ${buttonPadding} rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-110 hover:bg-blue-600 hover:shadow-md ${
                isActive('/category') ? 'bg-blue-700 text-white shadow-md' : 'text-white'
              } ${isSidebarOpen ? '' : 'justify-center bg-blue-700/50 border border-blue-500/50'}`}
              onClick={() => setIsSidebarOpenMobile(false)}
            >
              <FaList className={`${isSidebarOpen ? 'mr-3' : ''}`} size={iconSize} />
              <span className={`transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                Công trình danh mục
              </span>
            </Link>
            <Link
              to="/minor-repair"
              className={`flex items-center ${buttonPadding} rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-110 hover:bg-blue-600 hover:shadow-md ${
                isActive('/minor-repair') ? 'bg-blue-700 text-white shadow-md' : 'text-white'
              } ${isSidebarOpen ? '' : 'justify-center bg-blue-700/50 border border-blue-500/50'}`}
              onClick={() => setIsSidebarOpenMobile(false)}
            >
              <FaWrench className={`${isSidebarOpen ? 'mr-3' : ''}`} size={iconSize} />
              <span className={`transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                Sửa chữa nhỏ
              </span>
            </Link>
            {user?.permissions?.approve && (
              <Link
                to="/settings"
                className={`flex items-center ${buttonPadding} rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-110 hover:bg-blue-600 hover:shadow-md ${
                  isActive('/settings') ? 'bg-blue-700 text-white shadow-md' : 'text-white'
                } ${isSidebarOpen ? '' : 'justify-center bg-blue-700/50 border border-blue-500/50'}`}
                onClick={() => setIsSidebarOpenMobile(false)}
              >
                <FaCog className={`${isSidebarOpen ? 'mr-3' : ''}`} size={iconSize} />
                <span className={`transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                  Thiết lập
                </span>
              </Link>
            )}
          </nav>

          <div className="mt-auto p-3 border-t border-blue-700 overflow-x-hidden overflow-y-hidden">
            <button
              onClick={handleLogout}
              className={`flex items-center ${buttonPadding} rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-110 hover:bg-red-600 hover:shadow-md w-full text-left text-white ${
                isSidebarOpen ? '' : 'justify-center bg-blue-700/50 border border-blue-500/50'
              }`}
            >
              <FaSignOutAlt className={`${isSidebarOpen ? 'mr-3' : ''}`} size={iconSize} />
              <span className={`transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                Đăng xuất
              </span>
            </button>
          </div>
        </div>
      </div>

      {isSidebarOpenMobile && (
        <div
          className="md:hidden fixed inset-0 bg-black opacity-70 z-[800]"
          onClick={() => {
            setIsSidebarOpenMobile(false);
            setIsSidebarOpen(true); // Đặt lại trạng thái mở trên mobile
          }}
        ></div>
      )}
    </>
  );
}

export default Sidebar;