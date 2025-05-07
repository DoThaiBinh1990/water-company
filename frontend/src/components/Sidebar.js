import { Link, useNavigate } from 'react-router-dom';
import { FaSignOutAlt, FaList, FaWrench, FaCog } from 'react-icons/fa';

function Sidebar({ user, onLogout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="w-64 bg-blue-900 text-white h-screen fixed shadow-lg">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-8">Quản lý công trình</h2>
        <nav>
          <ul className="space-y-2">
            <li>
              <Link
                to="/category"
                className="flex items-center p-3 rounded-lg hover:bg-blue-700 transition-all duration-200"
              >
                <FaList className="mr-3" />
                Công trình danh mục
              </Link>
            </li>
            <li>
              <Link
                to="/minor-repair"
                className="flex items-center p-3 rounded-lg hover:bg-blue-700 transition-all duration-200"
              >
                <FaWrench className="mr-3" />
                Sửa chữa nhỏ
              </Link>
            </li>
            {user?.role === 'admin' && (
              <li>
                <Link
                  to="/settings"
                  className="flex items-center p-3 rounded-lg hover:bg-blue-700 transition-all duration-200"
                >
                  <FaCog className="mr-3" />
                  Thiết lập
                </Link>
              </li>
            )}
            <li>
              <button
                onClick={handleLogout}
                className="flex items-center p-3 rounded-lg hover:bg-blue-700 transition-all duration-200 w-full text-left"
              >
                <FaSignOutAlt className="mr-3" />
                Đăng xuất
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

export default Sidebar;