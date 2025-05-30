import { Link, useLocation } from 'react-router-dom';
import { FaSignOutAlt, FaList, FaWrench, FaCog, FaArrowLeft, FaArrowRight, FaChartBar } from 'react-icons/fa'; // Thêm FaChartBar
import logo from '../assets/logo.png';

function Sidebar({ user, onLogout, isSidebarOpen, setIsSidebarOpen }) {
  const location = useLocation();

  const handleLogout = () => {
    onLogout();
    setIsSidebarOpen(false);
  };

  // Hàm kiểm tra xem đường dẫn có active không
  const isActive = (path) => {
    // Kiểm tra chính xác đường dẫn hiện tại
    if (location.pathname === path) return true;
    // Xử lý trường hợp trang chủ '/' mặc định là '/category'
    if (path === '/category' && location.pathname === '/') return true;
    // Xử lý trường hợp các route con của timeline
    if (path === '/timeline' && location.pathname.startsWith('/timeline')) return true;
    return false;
  };


  // Class để điều khiển Sidebar - phục hồi như file gốc để giữ giao diện trên PC
  const sidebarClass = `sidebar fixed left-0 bottom-0 z-[900] bg-gradient-to-b from-blue-800 to-blue-600 text-white shadow-2xl transform transition-all duration-300 ease-in-out flex flex-col overflow-x-hidden overflow-y-hidden top-12 md:top-0 ${
    isSidebarOpen ? 'translate-x-0 w-64 md:w-64' : '-translate-x-full w-64 md:w-16'
  } md:translate-x-0 md:bottom-0 md:h-auto top-[48px] md:top-0 bottom-0 h-auto`;

  // Điều chỉnh kích thước icon khi sidebar thu nhỏ
  const iconSize = 18; // Kích thước icon mặc định
  const iconSizeCollapsed = 24; // Kích thước icon khi thu nhỏ (lớn hơn để dễ nhìn)

  const spaceBetweenIcons = isSidebarOpen ? 'space-y-2' : 'space-y-4';
  const buttonPadding = isSidebarOpen ? 'py-3 px-4' : 'py-2 px-2';

  return (
    <>
      <div className={sidebarClass}>
        <div className="flex flex-col pt-2 pl-2 pb-6 pr-4 border-b border-blue-700 overflow-x-hidden overflow-y-hidden">
          <button
            className="hidden md:block self-start p-2 rounded-full bg-blue-700 text-white hover:bg-blue-800 transition-all duration-200 transform hover:scale-105"
            onClick={() => {
              if (typeof setIsSidebarOpen === 'function') {
                setIsSidebarOpen(!isSidebarOpen);
              } else {
                console.error("Header Error: setIsSidebarOpen prop is not a function or is undefined.");
              }
            }}
            aria-label={isSidebarOpen ? "Thu gọn Sidebar" : "Mở rộng Sidebar"}
          >
            {isSidebarOpen ? <FaArrowLeft size={16} /> : <FaArrowRight size={16} />}
          </button>

          <Link to="/category" className="flex flex-col items-center mt-0" onClick={() => setIsSidebarOpen(false)}>
            <div className="bg-white p-1">
              <img
                src={logo}
                alt="Logo Công ty"
                className={`${isSidebarOpen ? 'w-24 h-24' : 'w-24 h-24 md:w-12 md:h-12'} transform hover:scale-105 transition-transform duration-200`}
              />
            </div>
            <h2 className={`text-base font-semibold text-white mt-2 text-center transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
              LAWASUCO
            </h2>
          </Link>
        </div>

        <div className="flex flex-col h-full">
          <nav className={`pt-8 px-3 pb-3 ${spaceBetweenIcons} overflow-x-hidden overflow-y-hidden`}>
            {/* 1. Công trình danh mục */}
            <Link
              to="/category"
              className={`flex items-center ${buttonPadding} rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-110 hover:bg-blue-600 hover:shadow-md ${
                isActive('/category') ? 'bg-blue-700 text-white shadow-md' : 'text-white'
              } ${isSidebarOpen ? '' : 'justify-center bg-blue-700/50 border border-blue-500/50'}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <FaList className={`${isSidebarOpen ? 'mr-3' : ''} ${!isSidebarOpen && isActive('/category') ? 'text-yellow-300' : ''}`} size={isSidebarOpen ? iconSize : iconSizeCollapsed} />
              <span className={`transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                Công trình danh mục
              </span>
            </Link>
            {/* 2. Sửa chữa nhỏ */}
            <Link
              to="/minor-repair"
              className={`flex items-center ${buttonPadding} rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-110 hover:bg-blue-600 hover:shadow-md ${
                isActive('/minor-repair') ? 'bg-blue-700 text-white shadow-md' : 'text-white'
              } ${isSidebarOpen ? '' : 'justify-center bg-blue-700/50 border border-blue-500/50'}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <FaWrench className={`${isSidebarOpen ? 'mr-3' : ''} ${!isSidebarOpen && isActive('/minor-repair') ? 'text-yellow-300' : ''}`} size={isSidebarOpen ? iconSize : iconSizeCollapsed} />
              <span className={`transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                Sửa chữa nhỏ
              </span>
            </Link>
             {/* 3. Quản lý Timeline */}
            <Link
              to="/timeline"
              className={`flex items-center ${buttonPadding} rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-110 hover:bg-blue-600 hover:shadow-md ${
                isActive('/timeline') ? 'bg-blue-700 text-white shadow-md' : 'text-white'
              } ${isSidebarOpen ? '' : 'justify-center bg-blue-700/50 border border-blue-500/50'}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <FaChartBar className={`${isSidebarOpen ? 'mr-3' : ''} ${!isSidebarOpen && isActive('/timeline') ? 'text-yellow-300' : ''}`} size={isSidebarOpen ? iconSize : iconSizeCollapsed} />
              <span className={`transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                Quản lý Timeline
              </span>
            </Link>
            {/* 4. Thiết lập */}
            {/* Tất cả user đã đăng nhập đều có thể thấy mục Thiết lập (để vào Thông tin cá nhân) */}
            <Link
              to="/settings"
              className={`flex items-center ${buttonPadding} rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-110 hover:bg-blue-600 hover:shadow-md ${
                isActive('/settings') ? 'bg-blue-700 text-white shadow-md' : 'text-white'
              } ${isSidebarOpen ? '' : 'justify-center bg-blue-700/50 border border-blue-500/50'}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <FaCog className={`${isSidebarOpen ? 'mr-3' : ''} ${!isSidebarOpen && isActive('/settings') ? 'text-yellow-300' : ''}`} size={isSidebarOpen ? iconSize : iconSizeCollapsed} />
              <span className={`transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                Thiết lập
              </span>
            </Link>
            {/* Thêm các mục khác nếu có ở đây */}
          </nav>
          {/* Nút Đăng xuất sẽ ở dưới cùng nhờ mt-auto */}
          <div className="mt-auto p-3 border-t border-blue-700 overflow-x-hidden overflow-y-hidden">
            <button
              onClick={handleLogout}
              className={`flex items-center ${buttonPadding} rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-110 hover:bg-red-600 hover:shadow-md w-full text-left text-white ${
                isSidebarOpen ? '' : 'justify-center bg-blue-700/50 border border-blue-500/50'
              }`}
            > {/* No highlight for logout icon */}
              <FaSignOutAlt className={`${isSidebarOpen ? 'mr-3' : ''}`} size={isSidebarOpen ? iconSize : iconSizeCollapsed} />
              <span className={`transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                Đăng xuất
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Overlay cho mobile khi sidebar mở */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed left-0 right-0 top-[48px] bottom-0 bg-black opacity-70 z-[800]"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </>
  );
}

export default Sidebar;
