import React, { useState, useEffect, useMemo, useRef } from 'react';
import organizationService from '../../services/organizationService';
import { Loader2, ChevronRight, Building2, MapPin, CheckCircle2, Search, AlertCircle, X, ChevronDown, Map } from 'lucide-react';

// --- GLOBAL HIERARCHY UTILITIES ---
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

const CascadingUnitSelector = ({ 
  value, 
  onChange, 
  sourceNodeId, 
  initialTree, 
  loading: externalLoading, 
  className = "",
  variant = "inline" // "inline" or "dropdown"
}) => {
  const [internalTree, setInternalTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState([]); 
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (initialTree) {
      setInternalTree(initialTree);
      setLoading(externalLoading || false);
    } else {
      fetchTree();
    }
  }, [initialTree, externalLoading]);

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

  useEffect(() => {
    if (sourceNodeId && !value && flatNodes.length > 0) {
      const perspectivePath = findPathFromFlat(flatNodes, sourceNodeId);
      if (perspectivePath && perspectivePath.length > 0) {
        setSelectedPath(perspectivePath);
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

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredFlatNodes = useMemo(() => {
    if (!searchTerm) return [];
    return flatNodes.filter(n => 
      n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.code && n.code.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 10);
  }, [flatNodes, searchTerm]);

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
      // Close dropdown if it's a leaf node or if user is done
      if (!selectedNode.children || selectedNode.children.length === 0) {
        // We might want to keep it open for multi-level, but for simplicity:
        // setIsOpen(false); 
      }
    }
  };

  if (loading || internalTree.length === 0) {
    return (
      <div className={`flex items-center justify-center p-4 bg-slate-50/10 border border-white/10 rounded-2xl animate-pulse ${className}`}>
        <Loader2 className="animate-spin text-blue-400 mr-2" size={16} />
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Syncing Hierarchy...</span>
      </div>
    );
  }

  const levels = [];
  if (tree.length > 0) {
    let initialNodes = tree;
    let initialLabel = tree[0]?.type?.name || 'Institutional Registry';

    if (sourceNodeId && flatNodes.length > 0) {
      const sourceNode = flatNodes.find(n => String(n.id) === String(sourceNodeId));
      if (sourceNode && sourceNode.children && sourceNode.children.length > 0) {
        initialNodes = sourceNode.children;
        const childType = initialNodes[0].type?.name || initialNodes[0].organizationLevel?.name || 'Sub-Unit';
        initialLabel = `${childType} Distribution`;
      } else if (sourceNode) {
        return (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center">
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">End of Path</span>
          </div>
        );
      }
    }

    levels.push({ label: initialLabel, nodes: initialNodes, selectedId: selectedPath[0]?.id || '' });
    const pathOffset = (sourceNodeId) ? (selectedPath.findIndex(n => String(n.id) === String(initialNodes[0]?.id)) || 0) : 0;
    
    selectedPath.slice(pathOffset).forEach((node, index) => {
      const nodeWithChildren = flatNodes.find(n => String(n.id) === String(node.id));
      const children = nodeWithChildren?.children || [];
      if (children.length > 0) {
        const childTypeName = children[0].type?.name || children[0].organizationLevel?.name || 'Sub-Unit';
        levels.push({ label: `${childTypeName} Selection`, nodes: children, selectedId: selectedPath[index + 1]?.id || '' });
      }
    });
  }

  const activeNode = selectedPath[selectedPath.length - 1];

  // ── RENDER DROPDOWN VARIANT ────────────────────────────────────────────────
  if (variant === "dropdown") {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full h-full flex items-center justify-between px-6 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl transition-all group"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <MapPin size={16} className="text-blue-400 shrink-0" />
            <div className="text-left overflow-hidden">
              <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest truncate">
                {activeNode?.type?.name || 'Scope Focus'}
              </div>
              <div className="text-xs font-black text-white uppercase italic truncate">
                {activeNode?.name || 'Global Registry'}
              </div>
            </div>
          </div>
          <ChevronDown size={16} className={`text-white/40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-4 w-[340px] bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.5)] z-[100] p-8 space-y-6 animate-in zoom-in-95 slide-in-from-top-4 duration-300">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                      <Building2 size={16} />
                   </div>
                   <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Hierarchy Scope</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                   <X size={18} />
                </button>
             </div>

             <div className="space-y-5">
                {levels.map((level, index) => (
                  <div key={index} className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">{level.label}</label>
                    <select
                      className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-[10px] font-black text-white uppercase outline-none focus:border-blue-500 transition-all"
                      value={level.selectedId}
                      onChange={(e) => handleSelectLevel(index, e.target.value)}
                    >
                      <option value="" className="bg-slate-900 text-slate-400">-- Choose --</option>
                      {level.nodes.map(node => (
                        <option key={node.id} value={node.id} className="bg-slate-900 text-white font-bold">
                          {node.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
             </div>

             {selectedPath.length > 0 && (
               <div className="pt-4 border-t border-white/5">
                  <div className="p-4 bg-white/5 rounded-2xl space-y-2">
                     <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Active Path:</span>
                     <div className="flex flex-wrap items-center gap-2">
                        {selectedPath.map((node, i) => (
                          <React.Fragment key={node.id}>
                             <span className="text-[9px] font-bold text-white uppercase">{node.name}</span>
                             {i < selectedPath.length - 1 && <ChevronRight size={10} className="text-slate-600" />}
                          </React.Fragment>
                        ))}
                     </div>
                  </div>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="w-full mt-4 h-12 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all"
                  >
                    Confirm Scope
                  </button>
               </div>
             )}
          </div>
        )}
      </div>
    );
  }

  // ── RENDER INLINE VARIANT (FOR FORMS/STORE) ────────────────────────────────
  return (
    <div className={`space-y-5 ${className}`}>
      <div className="flex justify-end">
        <button 
          type="button"
          onClick={() => setShowSearch(!showSearch)}
          className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-colors flex items-center gap-2"
        >
          {showSearch ? 'Use Hierarchy Selection' : 'Search by Name'}
          <Search size={10} />
        </button>
      </div>

      {showSearch ? (
        <div className="space-y-4">
           <input 
             type="text"
             placeholder="SEARCH..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full h-14 bg-white border-2 border-slate-900 rounded-2xl px-6 font-black text-[11px] outline-none shadow-xl shadow-slate-900/5 transition-all"
           />
           {filteredFlatNodes.length > 0 && (
             <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-2xl">
               {filteredFlatNodes.map(node => (
                 <button
                   key={node.id}
                   type="button"
                   onClick={() => {
                     const path = findPathFromFlat(flatNodes, node.id);
                     if (path) setSelectedPath(path);
                     onChange(String(node.id));
                     setShowSearch(false);
                   }}
                   className="w-full flex justify-between items-center p-4 hover:bg-blue-50 transition-all border-b border-slate-50 last:border-0"
                 >
                    <span className="text-[10px] font-black text-slate-900 uppercase">{node.name}</span>
                    <ChevronRight size={12} className="text-slate-300" />
                 </button>
               ))}
             </div>
           )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {levels.map((level, index) => (
            <div key={index} className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{level.label}</label>
              <select
                className={`w-full h-14 rounded-2xl px-6 font-black text-[11px] uppercase outline-none transition-all ${level.selectedId ? 'bg-white border-2 border-slate-900 shadow-xl' : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'}`}
                value={level.selectedId}
                onChange={(e) => handleSelectLevel(index, e.target.value)}
              >
                <option value="">-- Choose --</option>
                {level.nodes.map(node => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {selectedPath.length > 0 && (
        <div className="p-5 bg-slate-900 rounded-3xl border-b-4 border-slate-950">
           <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {selectedPath.map((node, i) => (
                <React.Fragment key={node.id}>
                   <span className="text-[10px] font-black text-white whitespace-nowrap">{node.name}</span>
                   {i < selectedPath.length - 1 && <ChevronRight size={10} className="text-slate-700" />}
                </React.Fragment>
              ))}
           </div>
        </div>
      )}
    </div>
  );
};

export default CascadingUnitSelector;
