import { NavLink } from 'react-router-dom';
import { FaProjectDiagram, FaTools, FaCog } from 'react-icons/fa';

function Sidebar() {
  return (
    <div className="w-64 bg-blue-800 text-white h-screen p-4">
      <h2 className="text-2xl font-bold mb-6">Quản lý công trình</h2>
      <nav>
        <NavLink
          to="/category"
          className={({ isActive }) =>
            `flex items-center gap-2 p-2 rounded mb-2 ${isActive ? 'bg-blue-600' : 'hover:bg-blue-700'}`
          }
        >
          <FaProjectDiagram /> Công trình danh mục
        </NavLink>
        <NavLink
          to="/minor-repair"
          className={({ isActive }) =>
            `flex items-center gap-2 p-2 rounded mb-2 ${isActive ? 'bg-blue-600' : 'hover:bg-blue-700'}`
          }
        >
          <FaTools /> Sửa chữa nhỏ
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2 p-2 rounded mb-2 ${isActive ? 'bg-blue-600' : 'hover:bg-blue-700'}`
          }
        >
          <FaCog /> Thiết lập
        </NavLink>
      </nav>
    </div>
  );
}

export default Sidebar;