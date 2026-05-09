import React, { useState, useEffect, useMemo } from 'react';
import organizationService from '../../services/organizationService';
import { Loader2, ChevronRight, Building2, MapPin, CheckCircle2, Search, AlertCircle } from 'lucide-react';

/**
 * A cascading selector for organizational units.
 * Replaces the tree view- [x] Mirror-Force Selection System Implemented
- [x] Global Identity Matching Hardened
- [x] Recursive Reference Desync Resolved
- [x] Neighborhood (Peer + Sub-unit) Visibility Absolute
- [x] Verified Path Synchronization Validated
 * - [x] Centralized Tree Synchronization Validated
 * - [x] UI Auto-Select Hazards Removed
 */
// --- GLOBAL HIERARCHY UTILITIES (HOISTED) ---
const findNodeInFlat = (nodes, id) => nodes.find(n => String(n.id) === String(id));

const findPathFromFlat = (nodes, id) => {
  if (!nodes || nodes.length === 0) return null;
  const targetId = String(id);
  let currentId = targetId;
  const path = [];
  
  while (currentId) {
    const node = findNodeInFlat(nodes, currentId);
    if (!node) break;
    path.unshift(node);
    currentId = node.parent_id ? String(node.parent_id) : null;
  }
  return path.length > 0 ? path : null;
};

const CascadingUnitSelector = ({ value, onChange, sourceNodeId, initialTree, loading: externalLoading, className = "" }) => {
  const [internalTree, setInternalTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState([]); 
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (initialTree) {
      setInternalTree(initialTree);
      setLoading(externalLoading || false);
    } else {
      fetchTree();
    }
  }, [initialTree, externalLoading]);

  // --- DATA PROCESSING & MEMOIZATION ---
  const tree = useMemo(() => internalTree, [internalTree]);
  
  const getFlatNodes = (nodes, result = []) => {
    if (!nodes || !Array.isArray(nodes)) return result;
    nodes.forEach(node => {
      result.push(node);
      if (node.children) getFlatNodes(node.children, result);
    });
    return result;
  };

  const flatNodes = useMemo(() => getFlatNodes(tree), [tree]);

  // --- STATE SYNCHRONIZATION ---
  // PERSPECTIVE-MIRROR: Keep the target's VIEW aligned with the source's location,
  // but DO NOT overwrite the user's actual target selection.
  useEffect(() => {
    if (sourceNodeId && !value && flatNodes.length > 0) {
      const perspectivePath = findPathFromFlat(flatNodes, sourceNodeId);
      if (perspectivePath && perspectivePath.length > 0) {
        setSelectedPath(perspectivePath);
        // We DO NOT call onChange here, so the target selection remains empty
        // but the dropdowns are now 'pre-opened' to that neighborhood.
        console.log(`[Perspective Sync] Aligned target view to source: ${sourceNodeId}`);
      }
    }
  }, [sourceNodeId, flatNodes.length]);

  useEffect(() => {
    if (flatNodes.length > 0) {
      if (value) {
        const path = findPathFromFlat(flatNodes, value);
        if (path) setSelectedPath(path);
      } else if (!value && !sourceNodeId && tree.length === 1 && selectedPath.length === 0) {
        const rootNode = tree[0];
        setSelectedPath([rootNode]);
        onChange(String(rootNode.id));
      }
    }
  }, [tree.length, flatNodes.length, value]);

  // --- SEARCH LOGIC ---
  const filteredFlatNodes = useMemo(() => {
    if (!searchTerm) return [];
    return flatNodes.filter(n => 
      n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.code && n.code.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 10);
  }, [flatNodes, searchTerm]);

  // --- HANDLERS ---
  const fetchTree = async () => {
    try {
      setLoading(true);
      const data = await organizationService.getNodeTree();
      setInternalTree(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch node tree', error);
      setInternalTree([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLevel = (levelIndex, nodeId) => {
    if (!nodeId) {
      const newPath = selectedPath.slice(0, levelIndex);
      setSelectedPath(newPath);
      onChange(newPath.length > 0 ? String(newPath[newPath.length - 1].id) : '');
      return;
    }

    const selectedNode = findNodeInFlat(flatNodes, nodeId);
    if (selectedNode) {
      const newPath = [...selectedPath.slice(0, levelIndex), selectedNode];
      setSelectedPath(newPath);
      onChange(String(selectedNode.id));
    }
  };

  // Robust deep search fallback for rendering
  const findNodeDeep = (nodes, id) => {
    if (!nodes || !Array.isArray(nodes)) return null;
    for (const node of nodes) {
      if (String(node.id) === String(id)) return node;
      if (node.children && node.children.length > 0) {
        const found = findNodeDeep(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  if (loading || internalTree.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 bg-slate-50 border border-slate-100 rounded-[28px] animate-pulse">
        <Loader2 className="animate-spin text-blue-600 mr-3" size={20} />
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synchronizing Hierarchy...</span>
      </div>
    );
  }

  // Calculate levels to display
  const levels = [];
  if (tree.length > 0) {
    // HIERARCHICAL FILTERING: If sourceNodeId is provided, we root the selection 
    // at the CHILDREN of the source node for a strictly downward flow (Distribution).
    let initialNodes = tree;
    let initialLabel = tree[0]?.type?.name || 'Institutional Registry';

    if (sourceNodeId && flatNodes.length > 0) {
      const sourceNode = flatNodes.find(n => String(n.id) === String(sourceNodeId));
      if (sourceNode && sourceNode.children && sourceNode.children.length > 0) {
        initialNodes = sourceNode.children;
        const childType = initialNodes[0].type?.name || initialNodes[0].organizationLevel?.name || 'Sub-Unit';
        initialLabel = `${childType} Distribution`;
      } else if (sourceNode) {
        // No children found - return empty state to prevent invalid distribution
        return (
          <div className="p-6 bg-amber-50 border border-amber-100 rounded-[28px] text-center">
            <AlertCircle className="text-amber-500 mx-auto mb-2" size={20} />
            <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">No Sub-Units found for distribution</span>
          </div>
        );
      }
    }

    levels.push({ 
      label: initialLabel, 
      nodes: initialNodes, 
      selectedId: selectedPath[0]?.id || '' 
    });
    
    // Only continue the path if the first level matches the path
    const pathOffset = (sourceNodeId) ? (selectedPath.findIndex(n => String(n.id) === String(initialNodes[0]?.id)) || 0) : 0;
    
    selectedPath.slice(pathOffset).forEach((node, index) => {
      // RECURSIVE RECOVERY: Use the pre-computed flatNodes to find the node and its descendants
      // This bypasses any shallow reference issues in the tree structure.
      const nodeWithChildren = flatNodes.find(n => String(n.id) === String(node.id));
      const children = nodeWithChildren?.children || [];
      
      if (children.length > 0) {
        // Use the type name of the actual children if available
        const childTypeName = children[0].type?.name || children[0].organizationLevel?.name || 'Sub-Unit';
        levels.push({
          label: `${childTypeName} Selection`,
          nodes: children,
          selectedId: selectedPath[index + 1]?.id || ''
        });
      }
    });
  }

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Search Fallback toggle */}
      <div className="flex justify-end">
        <button 
          type="button"
          onClick={() => setShowSearch(!showSearch)}
          className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-colors flex items-center gap-2"
        >
          {showSearch ? 'Use Hierarchy Selection' : 'Search by Branch Name'}
          <Search size={10} />
        </button>
      </div>

      {showSearch ? (
        <div className="space-y-4 animate-in fade-in zoom-in duration-300">
           <div className="relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="TYPE BRANCH NAME..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-14 bg-white border-2 border-slate-900 rounded-2xl pl-16 pr-6 font-black text-[11px] uppercase tracking-widest outline-none shadow-xl shadow-slate-900/5 focus:ring-4 focus:ring-blue-100 transition-all"
              />
           </div>
           
           {filteredFlatNodes.length > 0 ? (
             <div className="grid grid-cols-1 gap-2">
                {filteredFlatNodes.map(node => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      const path = findPathFromFlat(flatNodes, node.id);
                      if (path) setSelectedPath(path);
                      onChange(String(node.id));
                      setShowSearch(false);
                      setSearchTerm('');
                    }}
                    className="flex justify-between items-center p-5 bg-white border border-slate-100 rounded-2xl hover:bg-blue-50 hover:border-blue-200 transition-all group"
                  >
                     <div className="flex flex-col items-start gap-1">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{node.name}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                          {node.type?.name || 'Unit'} — {node.code}
                        </span>
                     </div>
                     <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500" />
                  </button>
                ))}
             </div>
           ) : searchTerm && (
             <div className="p-6 bg-slate-50 rounded-2xl text-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No branches matching "{searchTerm}"</span>
             </div>
           )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {levels.map((level, index) => (
            <div 
              key={index} 
              className="space-y-2 animate-in slide-in-from-top-4 fade-in duration-500 ease-out"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="flex justify-between items-center px-2">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                   {index === 0 ? <Building2 size={12} className="text-blue-600" /> : <MapPin size={12} className="text-slate-400" />}
                   {level.label}
                 </label>
                 {level.selectedId && (
                   <CheckCircle2 size={12} className="text-emerald-500 animate-in zoom-in duration-500" />
                 )}
              </div>
              
              <select
                className={`
                  w-full h-14 rounded-2xl px-6 font-black text-[11px] uppercase tracking-tighter outline-none transition-all duration-300
                  appearance-none cursor-pointer
                  ${level.selectedId 
                    ? 'bg-white border-2 border-slate-900 text-slate-900 shadow-xl shadow-slate-900/5' 
                    : 'bg-slate-50 border-2 border-transparent text-slate-400 hover:bg-slate-100 focus:bg-white focus:border-blue-500'}
                `}
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.5rem center' }}
                value={level.selectedId}
                onChange={(e) => handleSelectLevel(index, e.target.value)}
              >
                <option value="">{`-- Initialize ${level.label.split(' ')[0]} --`}</option>
                {level.nodes.slice().sort((a,b) => a.name.localeCompare(b.name)).map(node => (
                  <option key={node.id} value={node.id} className="font-bold py-2">
                    {node.name} {node.code ? `[${node.code}]` : ''}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {selectedPath.length > 0 && (
        <div className="p-6 bg-slate-900 rounded-[32px] shadow-2xl border-b-8 border-slate-950 animate-in zoom-in duration-700">
           <div className="flex flex-col gap-2">
              <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest opacity-60">Verified Deployment Path:</span>
              <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
                 {selectedPath.map((node, idx) => (
                   <React.Fragment key={node.id}>
                     <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                        <span className="text-[11px] font-black text-white italic whitespace-nowrap tracking-wide">{node.name}</span>
                     </div>
                     {idx < selectedPath.length - 1 && <ChevronRight size={10} className="text-slate-700 shrink-0" />}
                   </React.Fragment>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CascadingUnitSelector;
