import React from 'react';
import { useFetch } from '../../hooks/useFetch';
import LoadingSpinner from '../common/LoadingSpinner';
import { ShieldCheckIcon, KeyIcon } from '@heroicons/react/24/outline';

const PermissionSidebar = () => {
  const { data: permissions, loading } = useFetch('/permissions');

  if (loading) return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-center h-fit">
      <LoadingSpinner />
    </div>
  );

  // Group permissions by resource
  const groupedPermissions = permissions?.reduce((acc, perm) => {
    const [resource] = perm.name?.split(':') || ['other'];
    if (!acc[resource]) acc[resource] = [];
    acc[resource].push(perm);
    return acc;
  }, {}) || {};

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit sticky top-6">
      <div className="flex items-center space-x-2 mb-6">
        <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
          <ShieldCheckIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">System Permissions</h2>
          <p className="text-xs text-gray-500">Global access control list</p>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedPermissions).map(([resource, perms]) => (
          <div key={resource}>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center">
              <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mr-2"></span>
              {resource} Management
            </h3>
            <ul className="space-y-2">
              {perms.map(perm => (
                <li key={perm.id} className="group flex items-start space-x-3 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="p-1.5 bg-gray-100 group-hover:bg-primary-50 rounded-lg text-gray-400 group-hover:text-primary-600 transition-colors">
                    <KeyIcon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 capitalize">
                      {perm.name?.split(':')[1]?.replace(/-/g, ' ') || perm.name}
                    </p>
                    {perm.description && (
                      <p className="text-xs text-gray-400 line-clamp-1">{perm.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100">
        <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200">
          <p className="text-xs text-gray-500 leading-relaxed">
            "These permissions define what actions roles can perform across the entire AIRMS ecosystem."
          </p>
        </div>
      </div>
    </div>
  );
};

export default PermissionSidebar;
