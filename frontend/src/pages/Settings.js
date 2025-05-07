import { useState, useEffect } from 'react';
import axios from 'axios';
import { FaUserPlus, FaBuilding, FaHardHat, FaEdit, FaTrash, FaPlus } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { API_URL } from '../config';

function Settings({ user }) {
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'staff',
    permissions: { add: false, edit: false, delete: false, approve: false }
  });
  const [newAllocatedUnit, setNewAllocatedUnit] = useState('');
  const [editAllocatedUnit, setEditAllocatedUnit] = useState(null);
  const [newConstructionUnit, setNewConstructionUnit] = useState('');
  const [editConstructionUnit, setEditConstructionUnit] = useState(null);
  const [newAllocationWave, setNewAllocationWave] = useState('');
  const [editAllocationWave, setEditAllocationWave] = useState(null);
  const [users, setUsers] = useState([]);
  const [allocatedUnits, setAllocatedUnits] = useState([]);
  const [constructionUnits, setConstructionUnits] = useState([]);
  const [allocationWaves, setAllocationWaves] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    axios.get(`${API_URL}/api/users`)
      .then(response => setUsers(response.data))
      .catch(error => toast.error('Lỗi khi tải người dùng!'));

    axios.get(`${API_URL}/api/allocated-units`)
      .then(response => setAllocatedUnits(response.data))
      .catch(error => toast.error('Lỗi khi tải đơn vị phân bổ!'));

    axios.get(`${API_URL}/api/construction-units`)
      .then(response => setConstructionUnits(response.data))
      .catch(error => toast.error('Lỗi khi tải đơn vị thi công!'));

    axios.get(`${API_URL}/api/allocation-waves`)
      .then(response => setAllocationWaves(response.data))
      .catch(error => toast.error('Lỗi khi tải đợt phân bổ!'));
  };

  const saveUser = () => {
    const userData = { ...newUser };
    if (!userData.password) delete userData.password;
    const request = editingUserId
      ? axios.patch(`${API_URL}/api/users/${editingUserId}`, userData)
      : axios.post(`${API_URL}/api/users`, userData);

    request
      .then(response => {
        if (editingUserId) {
          setUsers(users.map(u => u._id === editingUserId ? response.data : u));
          toast.success('Đã cập nhật người dùng!');
        } else {
          setUsers([...users, response.data]);
          toast.success('Đã thêm người dùng!');
        }
        setNewUser({ username: '', password: '', role: 'staff', permissions: { add: false, edit: false, delete: false, approve: false } });
        setEditingUserId(null);
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi thêm/cập nhật người dùng!'));
  };

  const editUser = (user) => {
    setNewUser({
      username: user.username,
      password: '',
      role: user.role,
      permissions: user.permissions
    });
    setEditingUserId(user._id);
  };

  const deleteUser = (id) => {
    axios.delete(`${API_URL}/api/users/${id}`)
      .then(() => {
        setUsers(users.filter(u => u._id !== id));
        toast.success('Đã xóa người dùng!');
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi xóa người dùng!'));
  };

  const saveAllocatedUnit = () => {
    const request = editAllocatedUnit
      ? axios.patch(`${API_URL}/api/allocated-units/${editAllocatedUnit._id}`, { name: newAllocatedUnit })
      : axios.post(`${API_URL}/api/allocated-units`, { name: newAllocatedUnit });

    request
      .then(response => {
        if (editAllocatedUnit) {
          setAllocatedUnits(allocatedUnits.map(u => u._id === editAllocatedUnit._id ? response.data : u));
          toast.success('Đã cập nhật đơn vị phân bổ!');
        } else {
          setAllocatedUnits([...allocatedUnits, response.data]);
          toast.success('Đã thêm đơn vị phân bổ!');
        }
        setNewAllocatedUnit('');
        setEditAllocatedUnit(null);
        fetchData();
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi thêm/cập nhật đơn vị phân bổ!'));
  };

  const deleteAllocatedUnit = (id) => {
    axios.delete(`${API_URL}/api/allocated-units/${id}`)
      .then(() => {
        setAllocatedUnits(allocatedUnits.filter(u => u._id !== id));
        toast.success('Đã xóa đơn vị phân bổ!');
        fetchData();
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi xóa đơn vị phân bổ!'));
  };

  const saveConstructionUnit = () => {
    const request = editConstructionUnit
      ? axios.patch(`${API_URL}/api/construction-units/${editConstructionUnit._id}`, { name: newConstructionUnit })
      : axios.post(`${API_URL}/api/construction-units`, { name: newConstructionUnit });

    request
      .then(response => {
        if (editConstructionUnit) {
          setConstructionUnits(constructionUnits.map(u => u._id === editConstructionUnit._id ? response.data : u));
          toast.success('Đã cập nhật đơn vị thi công!');
        } else {
          setConstructionUnits([...constructionUnits, response.data]);
          toast.success('Đã thêm đơn vị thi công!');
        }
        setNewConstructionUnit('');
        setEditConstructionUnit(null);
        fetchData();
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi thêm/cập nhật đơn vị thi công!'));
  };

  const deleteConstructionUnit = (id) => {
    axios.delete(`${API_URL}/api/construction-units/${id}`)
      .then(() => {
        setConstructionUnits(constructionUnits.filter(u => u._id !== id));
        toast.success('Đã xóa đơn vị thi công!');
        fetchData();
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi xóa đơn vị thi công!'));
  };

  const saveAllocationWave = () => {
    const request = editAllocationWave
      ? axios.patch(`${API_URL}/api/allocation-waves/${editAllocationWave._id}`, { name: newAllocationWave })
      : axios.post(`${API_URL}/api/allocation-waves`, { name: newAllocationWave });

    request
      .then(response => {
        if (editAllocationWave) {
          setAllocationWaves(allocationWaves.map(w => w._id === editAllocationWave._id ? response.data : w));
          toast.success('Đã cập nhật đợt phân bổ!');
        } else {
          setAllocationWaves([...allocationWaves, response.data]);
          toast.success('Đã thêm đợt phân bổ!');
        }
        setNewAllocationWave('');
        setEditAllocationWave(null);
        fetchData();
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi thêm/cập nhật đợt phân bổ!'));
  };

  const deleteAllocationWave = (id) => {
    axios.delete(`${API_URL}/api/allocation-waves/${id}`)
      .then(() => {
        setAllocationWaves(allocationWaves.filter(w => w._id !== id));
        toast.success('Đã xóa đợt phân bổ!');
        fetchData();
      })
      .catch(error => toast.error(error.response?.data?.message || 'Lỗi khi xóa đợt phân bổ!'));
  };

  return (
    <div className="p-6 bg-blue-50">
      <h1 className="text-3xl font-bold text-blue-800 mb-6">Thiết lập</h1>
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold text-blue-700 mb-4">{editingUserId ? 'Cập nhật người dùng' : 'Thêm người dùng'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Tên người dùng"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            className="border border-blue-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Mật khẩu (để trống nếu không đổi)"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            className="border border-blue-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={newUser.role}
            onChange={(e) => {
              const role = e.target.value;
              const defaultPermissions = {
                admin: { add: true, edit: true, delete: true, approve: true },
                director: { add: true, edit: true, delete: true, approve: true },
                deputy_director: { add: true, edit: true, delete: true, approve: true },
                manager: { add: true, edit: true, delete: false, approve: true },
                deputy_manager: { add: true, edit: true, delete: false, approve: false },
                staff: { add: true, edit: false, delete: false, approve: false },
                branch_director: { add: true, edit: true, delete: true, approve: true },
                branch_deputy_director: { add: true, edit: true, delete: false, approve: false },
                branch_staff: { add: true, edit: false, delete: false, approve: false },
                worker: { add: false, edit: false, delete: false, approve: false },
              }[role] || { add: false, edit: false, delete: false, approve: false };
              setNewUser({ ...newUser, role, permissions: defaultPermissions });
            }}
            className="border border-blue-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="admin">Admin</option>
            <option value="director">Tổng giám đốc</option>
            <option value="deputy_director">Phó tổng giám đốc</option>
            <option value="manager">Trưởng phòng</option>
            <option value="deputy_manager">Phó phòng</option>
            <option value="staff">Nhân viên phòng</option>
            <option value="branch_director">Giám đốc chi nhánh</option>
            <option value="branch_deputy_director">Phó giám đốc chi nhánh</option>
            <option value="branch_staff">Nhân viên chi nhánh</option>
            <option value="worker">Công nhân trực tiếp</option>
          </select>
        </div>
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-blue-700 mb-2">Phân quyền</h3>
          <div className="flex gap-4">
            <label>
              <input
                type="checkbox"
                checked={newUser.permissions.add}
                onChange={(e) => setNewUser({ ...newUser, permissions: { ...newUser.permissions, add: e.target.checked } })}
              /> Thêm
            </label>
            <label>
              <input
                type="checkbox"
                checked={newUser.permissions.edit}
                onChange={(e) => setNewUser({ ...newUser, permissions: { ...newUser.permissions, edit: e.target.checked } })}
              /> Sửa
            </label>
            <label>
              <input
                type="checkbox"
                checked={newUser.permissions.delete}
                onChange={(e) => setNewUser({ ...newUser, permissions: { ...newUser.permissions, delete: e.target.checked } })}
              /> Xóa
            </label>
            <label>
              <input
                type="checkbox"
                checked={newUser.permissions.approve}
                onChange={(e) => setNewUser({ ...newUser, permissions: { ...newUser.permissions, approve: e.target.checked } })}
              /> Duyệt
            </label>
          </div>
        </div>
        <button
          onClick={saveUser}
          className="mt-4 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex items-center gap-2"
        >
          <FaUserPlus /> {editingUserId ? 'Cập nhật' : 'Thêm'} người dùng
        </button>
        {editingUserId && (
          <button
            onClick={() => {
              setNewUser({ username: '', password: '', role: 'staff', permissions: { add: false, edit: false, delete: false, approve: false } });
              setEditingUserId(null);
            }}
            className="mt-2 bg-gray-600 text-white p-2 rounded hover:bg-gray-700"
          >
            Hủy
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold text-blue-700 mb-4">Quản lý đơn vị phân bổ</h2>
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="Tên đơn vị phân bổ"
            value={newAllocatedUnit}
            onChange={(e) => setNewAllocatedUnit(e.target.value)}
            className="border border-blue-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
          />
          <button
            onClick={saveAllocatedUnit}
            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <FaBuilding /> {editAllocatedUnit ? 'Cập nhật' : 'Thêm'} đơn vị
          </button>
          {editAllocatedUnit && (
            <button
              onClick={() => {
                setNewAllocatedUnit('');
                setEditAllocatedUnit(null);
              }}
              className="bg-gray-600 text-white p-2 rounded hover:bg-gray-700"
            >
              Hủy
            </button>
          )}
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-blue-200">
              <th className="p-3 text-left text-blue-800">Tên đơn vị</th>
              <th className="p-3 text-left text-blue-800">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {allocatedUnits.map(unit => (
              <tr key={unit._id} className="border-t hover:bg-blue-50">
                <td className="p-3">{unit.name}</td>
                <td className="p-3 flex gap-2">
                  <button
                    onClick={() => {
                      setNewAllocatedUnit(unit.name);
                      setEditAllocatedUnit(unit);
                    }}
                    className="text-yellow-600 hover:text-yellow-800"
                    title="Sửa"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => deleteAllocatedUnit(unit._id)}
                    className="text-red-600 hover:text-red-800"
                    title="Xóa"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold text-blue-700 mb-4">Quản lý đơn vị thi công</h2>
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="Tên đơn vị thi công"
            value={newConstructionUnit}
            onChange={(e) => setNewConstructionUnit(e.target.value)}
            className="border border-blue-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
          />
          <button
            onClick={saveConstructionUnit}
            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <FaHardHat /> {editConstructionUnit ? 'Cập nhật' : 'Thêm'} đơn vị
          </button>
          {editConstructionUnit && (
            <button
              onClick={() => {
                setNewConstructionUnit('');
                setEditConstructionUnit(null);
              }}
              className="bg-gray-600 text-white p-2 rounded hover:bg-gray-700"
            >
              Hủy
            </button>
          )}
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-blue-200">
              <th className="p-3 text-left text-blue-800">Tên đơn vị</th>
              <th className="p-3 text-left text-blue-800">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {constructionUnits.map(unit => (
              <tr key={unit._id} className="border-t hover:bg-blue-50">
                <td className="p-3">{unit.name}</td>
                <td className="p-3 flex gap-2">
                  <button
                    onClick={() => {
                      setNewConstructionUnit(unit.name);
                      setEditConstructionUnit(unit);
                    }}
                    className="text-yellow-600 hover:text-yellow-800"
                    title="Sửa"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => deleteConstructionUnit(unit._id)}
                    className="text-red-600 hover:text-red-800"
                    title="Xóa"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-blue-700 mb-4">Quản lý đợt phân bổ</h2>
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="Tên đợt phân bổ"
            value={newAllocationWave}
            onChange={(e) => setNewAllocationWave(e.target.value)}
            className="border border-blue-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
          />
          <button
            onClick={saveAllocationWave}
            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <FaPlus /> {editAllocationWave ? 'Cập nhật' : 'Thêm'} đợt phân bổ
          </button>
          {editAllocationWave && (
            <button
              onClick={() => {
                setNewAllocationWave('');
                setEditAllocationWave(null);
              }}
              className="bg-gray-600 text-white p-2 rounded hover:bg-gray-700"
            >
              Hủy
            </button>
          )}
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-blue-200">
              <th className="p-3 text-left text-blue-800">Tên đợt phân bổ</th>
              <th className="p-3 text-left text-blue-800">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {allocationWaves.map(wave => (
              <tr key={wave._id} className="border-t hover:bg-blue-50">
                <td className="p-3">{wave.name}</td>
                <td className="p-3 flex gap-2">
                  <button
                    onClick={() => {
                      setNewAllocationWave(wave.name);
                      setEditAllocationWave(wave);
                    }}
                    className="text-yellow-600 hover:text-yellow-800"
                    title="Sửa"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => deleteAllocationWave(wave._id)}
                    className="text-red-600 hover:text-red-800"
                    title="Xóa"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mt-6">
        <h2 className="text-xl font-semibold text-blue-700 mb-4">Danh sách người dùng</h2>
        <table className="w-full">
          <thead>
            <tr className="bg-blue-200">
              <th className="p-3 text-left text-blue-800">Tên người dùng</th>
              <th className="p-3 text-left text-blue-800">Vai trò</th>
              <th className="p-3 text-left text-blue-800">Quyền</th>
              <th className="p-3 text-left text-blue-800">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id} className="border-t hover:bg-blue-50">
                <td className="p-3">{u.username}</td>
                <td className="p-3">{u.role}</td>
                <td className="p-3">
                  {u.permissions.add && 'Thêm, '}
                  {u.permissions.edit && 'Sửa, '}
                  {u.permissions.delete && 'Xóa, '}
                  {u.permissions.approve && 'Duyệt'}
                </td>
                <td className="p-3 flex gap-2">
                  <button
                    onClick={() => editUser(u)}
                    className="text-yellow-600 hover:text-yellow-800"
                    title="Sửa"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => deleteUser(u._id)}
                    className="text-red-600 hover:text-red-800"
                    disabled={u.role === 'admin'}
                    title={u.role === 'admin' ? 'Không thể xóa admin' : 'Xóa'}
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Settings;