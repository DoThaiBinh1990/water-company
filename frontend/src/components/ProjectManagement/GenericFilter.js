// d:\CODE\water-company\frontend\src\components\ProjectManagement\GenericFilter.js
import { FaEye, FaEyeSlash, FaSearch, FaFilter, FaUndo, FaSpinner, FaCalendarAlt } from 'react-icons/fa'; // Add useMemo
import { useState, useEffect, useMemo } from 'react';
import debounce from 'lodash/debounce';

function GenericFilter({
  filterConfig,
  filters,
  setFilters,
  dataSources,
  isLoading,
  onResetFilters,
  showFilter,
  setShowFilter,
}) {
  const [localTextFilters, setLocalTextFilters] = useState({});

  useEffect(() => {
    const initialLocalTextFilters = {};
    filterConfig.forEach(field => {
      if (field.type === 'text' || field.type === 'search') {
        initialLocalTextFilters[field.name] = filters[field.name] || '';
      }
    });
    setLocalTextFilters(initialLocalTextFilters);
  }, [filterConfig, filters]);

  // Memoize the debounced function itself
  const debouncedSetFilters =  useMemo(
    () => debounce((name, value) => {
      setFilters(prev => ({ ...prev, [name]: value }));
    }, 500),
    [setFilters]
  );

  const handleTextFilterChange = (e) => {
    const { name, value } = e.target;
    setLocalTextFilters(prev => ({ ...prev, [name]: value }));
    debouncedSetFilters(name, value);
  };

  const handleOtherFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const getOptionsForField = (field) => {
    if (field.optionsSource && dataSources && dataSources[field.optionsSource]) {
      return dataSources[field.optionsSource].map(item => {
        if (typeof item === 'object' && item !== null) {
          if ((field.optionsSource === 'usersList' || field.optionsSource === 'approversList') && item._id && (item.fullName || item.username)) {
            return { value: item._id, label: item.fullName || item.username };
          }
          const value = item.name || item._id || item.fullName || String(item);
          const label = item.name || item.fullName || String(item);
          return { value, label };
        }
        return { value: String(item), label: String(item) };
      });
    }
    return field.options || [];
  };

  return (
    <div className="filter-container card p-3 bg-white rounded-xl shadow-lg border border-gray-100 transition-all duration-300"> {/* p-4 to p-3 */}
      <div className="flex justify-between items-center mb-3"> {/* mb-4 to mb-3 */}
        <h2 className="text-gray-800 font-semibold tracking-tight flex items-center gap-2 text-base"> {/* Adjusted text size */}
          <FaFilter className="text-blue-600" size={16} />
          Bộ lọc
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onResetFilters}
            className="btn btn-reset flex items-center gap-1 bg-gray-200 text-gray-800 hover:bg-gray-300 transition-all duration-300 transform hover:scale-105 shadow-md rounded-lg px-4 py-2 text-sm md:px-3 md:py-1.5 md:text-xs"
            disabled={isLoading} // py-1.5 is fine for text-xs
            title="Đặt lại bộ lọc"
          >
            <FaUndo size={14} />
            <span className="hidden sm:inline">Đặt lại</span>
          </button>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="btn btn-secondary flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 shadow-md rounded-lg px-4 py-2 text-sm md:px-3 md:py-1.5 md:text-xs"
            title={showFilter ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
          >
            {showFilter ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
            <span className="hidden sm:inline">{showFilter ? 'Ẩn' : 'Hiện'}</span>
          </button>
        </div>
      </div>

      {showFilter && (
        <div className="filter-content grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"> {/* gap-4 to gap-3 */}
          {filterConfig.map(field => (
            <div key={field.name} className="relative">
              <label className="form-label text-gray-700 text-sm mb-0.5 block">{field.label}</label> {/* Adjusted label style */}
              {field.type === 'select' ? (
                <select
                  name={field.name}
                  value={filters[field.name] || ''}
                  onChange={handleOtherFilterChange}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-800 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-blue-400"
                  disabled={isLoading}
                  style={{ height: '36px' }} // height 40px to 36px
                >
                  <option value="">Tất cả</option>
                  {getOptionsForField(field).map((opt, index) => (
                    <option key={opt.value || index} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'date' ? (
                <div className="relative">
                   <FaCalendarAlt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                   <input
                     type="date"
                     name={field.name}
                     value={filters[field.name] || ''}
                     onChange={handleOtherFilterChange} // py-2 to py-1.5
                     className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-800 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-blue-400"
                     disabled={isLoading}
                     style={{ height: '36px' }} // height 40px to 36px
                   />
                </div>
              ) : (
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    name={field.name}
                    value={localTextFilters[field.name] || ''}
                    onChange={handleTextFilterChange} // py-2 to py-1.5, pr-9 to pr-3 if no spinner
                    className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-800 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-blue-400"
                    placeholder={field.placeholder || `Nhập ${field.label.toLowerCase()}...`}
                    disabled={isLoading}
                    style={{ height: '36px' }} // height 40px to 36px
                  />
                  {isLoading && (
                    <FaSpinner className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500 animate-spin" size={14} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GenericFilter;
