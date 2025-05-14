import { FaEye, FaEyeSlash, FaSearch, FaFilter, FaUndo, FaSpinner } from 'react-icons/fa';
import { useState, useEffect, useCallback } from 'react';
import debounce from 'lodash/debounce';

function CategoryProjectFilter({
  filterAllocatedUnit,
  setFilterAllocatedUnit,
  filterConstructionUnit,
  setFilterConstructionUnit,
  filterName,
  setFilterName,
  filterAllocationWave,
  setFilterAllocationWave,
  filterSupervisor,
  setFilterSupervisor,
  filterEstimator,
  setFilterEstimator,
  allocatedUnits,
  constructionUnitsList,
  allocationWavesList,
  usersList,
  isLoading,
  onResetFilters,
  showFilter,
  setShowFilter,
}) {
  const [localFilterName, setLocalFilterName] = useState(filterName);

  // Debounce hàm setFilterName để trì hoãn việc gọi API
  const debouncedSetFilterName = useCallback(
    debounce((value) => {
      setFilterName(value);
    }, 500),
    [setFilterName]
  );

  // Đồng bộ localFilterName với filterName từ parent
  useEffect(() => {
    setLocalFilterName(filterName);
  }, [filterName]);

  // Xử lý khi người dùng nhập
  const handleFilterNameChange = (e) => {
    const value = e.target.value;
    setLocalFilterName(value);
    debouncedSetFilterName(value);
  };

  return (
    <div className="filter-container card p-4 bg-white rounded-xl shadow-lg border border-gray-100 transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-subheading text-gray-800 font-semibold tracking-tight flex items-center gap-2">
          <FaFilter className="text-blue-600" size={16} />
          Bộ lọc
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onResetFilters}
            className="btn btn-reset flex items-center gap-1 bg-gray-200 text-gray-800 hover:bg-gray-300 transition-all duration-300 transform hover:scale-105 shadow-md rounded-lg px-3 py-1.5 text-xs"
            disabled={isLoading}
            title="Đặt lại bộ lọc"
          >
            <FaUndo size={14} />
            <span className="hidden sm:inline">Đặt lại</span>
          </button>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="btn btn-secondary flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 shadow-md rounded-lg px-3 py-1.5 text-xs"
            title={showFilter ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
          >
            {showFilter ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
            <span className="hidden sm:inline">{showFilter ? 'Ẩn' : 'Hiện'}</span>
          </button>
        </div>
      </div>

      {showFilter && (
        <div className="filter-content grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="relative">
            <label className="form-label text-gray-700">Tên công trình</label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={localFilterName}
                onChange={handleFilterNameChange}
                className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-blue-400"
                placeholder="Nhập tên công trình..."
                disabled={isLoading}
                style={{ height: '40px' }}
              />
              {isLoading && (
                <FaSpinner className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500 animate-spin" size={14} />
              )}
            </div>
          </div>

          <div className="relative">
            <label className="form-label text-gray-700">Đơn vị phân bổ</label>
            <select
              value={filterAllocatedUnit}
              onChange={(e) => setFilterAllocatedUnit(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-blue-400"
              disabled={isLoading}
              style={{ height: '40px' }}
            >
              <option value="">Tất cả</option>
              {allocatedUnits.map((unit, index) => (
                <option key={index} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className="form-label text-gray-700">Đơn vị thi công</label>
            <select
              value={filterConstructionUnit}
              onChange={(e) => setFilterConstructionUnit(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-blue-400"
              disabled={isLoading}
              style={{ height: '40px' }}
            >
              <option value="">Tất cả</option>
              {constructionUnitsList.map((unit, index) => (
                <option key={index} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className="form-label text-gray-700">Đợt phân bổ</label>
            <select
              value={filterAllocationWave}
              onChange={(e) => setFilterAllocationWave(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-blue-400"
              disabled={isLoading}
              style={{ height: '40px' }}
            >
              <option value="">Tất cả</option>
              {allocationWavesList.map((wave, index) => (
                <option key={index} value={wave}>
                  {wave}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className="form-label text-gray-700">Người theo dõi</label>
            <select
              value={filterSupervisor}
              onChange={(e) => setFilterSupervisor(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-blue-400"
              disabled={isLoading}
              style={{ height: '40px' }}
            >
              <option value="">Tất cả</option>
              {usersList.map((user, index) => (
                <option key={index} value={user}>
                  {user}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className="form-label text-gray-700">Người lập dự toán</label>
            <select
              value={filterEstimator}
              onChange={(e) => setFilterEstimator(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-blue-400"
              disabled={isLoading}
              style={{ height: '40px' }}
            >
              <option value="">Tất cả</option>
              {usersList.map((user, index) => (
                <option key={index} value={user}>
                  {user}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoryProjectFilter;