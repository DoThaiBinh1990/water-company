// d:\CODE\water-company\frontend\src\components\TimelineManagement\TimelineManagement.js
import React, { useState } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import ProfileTimelineCategory from './ProfileTimelineCategory';
import ConstructionTimelineCategory from './ConstructionTimelineCategory';
import ConstructionTimelineMinorRepair from './ConstructionTimelineMinorRepair';
import { FaUserClock, FaHardHat } from 'react-icons/fa';

const TimelineManagement = ({ user, addMessage }) => {
  const location = useLocation();
  // Xác định tab active dựa trên path, hoặc tab mặc định
  const getActiveTabFromPath = (pathname) => {
    if (pathname.includes('/timeline/profile-category')) return 'profile-category';
    if (pathname.includes('/timeline/construction-category')) return 'construction-category';
    if (pathname.includes('/timeline/construction-minor-repair')) return 'construction-minor-repair';
    return 'profile-category'; // Mặc định
  };
  const [activeTab, setActiveTab] = useState(getActiveTabFromPath(location.pathname));

  const tabs = [
    { name: 'profile-category', label: 'Timeline Hồ sơ DM', path: 'profile-category', icon: <FaUserClock/>, component: <ProfileTimelineCategory user={user} addMessage={addMessage} /> },
    { name: 'construction-category', label: 'Timeline Thi công DM', path: 'construction-category', icon: <FaHardHat/>, component: <ConstructionTimelineCategory user={user} addMessage={addMessage} /> },
    { name: 'construction-minor-repair', label: 'Timeline Thi công SCN', path: 'construction-minor-repair', icon: <FaHardHat/>, component: <ConstructionTimelineMinorRepair user={user} addMessage={addMessage} /> },
  ];

  return (
    <div className="flex flex-col min-h-screen py-3 px-1 md:py-4 md:px-2 lg:py-5 lg:px-3 pt-16 md:pt-8 bg-gradient-to-b from-gray-50 to-gray-100">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 animate-slideIn">Quản lý Timeline Công trình</h1>

      <div className="mb-6 border-b border-gray-300">
        <nav className="flex flex-wrap -mb-px">
          {tabs.map(tab => (
            <Link
              key={tab.name}
              to={`/timeline/${tab.path}`}
              onClick={() => setActiveTab(tab.name)}
              className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2
                ${activeTab === tab.name
                  ? 'border-blue-600 text-blue-700 bg-blue-50 rounded-t-md'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } transition-colors duration-150 ease-in-out`}
            >
              {tab.icon} {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex-grow">
        <Routes>
          {tabs.map(tab => (
            <Route key={tab.name} path={tab.path} element={tab.component} />
          ))}
          {/* Route mặc định cho /timeline, chuyển hướng đến tab đầu tiên */}
          <Route index element={<Navigate to={tabs[0].path} replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default TimelineManagement;
