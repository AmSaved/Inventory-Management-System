import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert, ArrowLeft, Plus, Trash2, Send, CheckCircle2, ClipboardList, ChevronLeft, ArrowRight
} from 'lucide-react';

const RequestProductPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [searchParams] = useSearchParams();

  const isEdit = searchParams.get('edit') === 'true';
  const requestId = searchParams.get('id');

  const canRequest = hasPermission('request:create');

  const [items, setItems] = useState([{ quantity: 1, specifications: '', category: '', sub_category: '' }]);
  const [purpose, setPurpose] = useState('');
  const [priority, setPriority] = useState('medium');
  const [expectedDate, setExpectedDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: productData } = useFetch('/products?limit=1000&is_active=true');
  const products = Array.isArray(productData) ? productData : (productData?.data || []);

  const normalizeSpecifications = (specifications) => {
    if (typeof specifications === 'string') {
      try { return JSON.parse(specifications); } catch { return {}; }
    }
    return typeof specifications === 'object' && specifications !== null ? specifications : {};
  };

  useEffect(() => {
    if (isEdit && requestId) {
      const fetchRequestForEdit = async () => {
        try {
          const res = await api.get(`/requests/${requestId}`);
          const request = res.data.data;
          setPurpose(request.purpose || '');
          setPriority(request.priority || 'medium');
          setExpectedDate(request.expected_delivery_date ? request.expected_delivery_date.split('T')[0] : '');
          const parsedItems = (request.items || []).map(item => {
            const specs = normalizeSpecifications(item.specifications);
            return {
              id: item.id,
              product_id: item.product_id || '',
              category: item.product?.category || specs.category || '',
              sub_category: item.product?.sub_category || specs.sub_category || '',
              quantity: item.quantity_requested || 1,
              specifications: specs.notes || item.specifications || ''
            };
          });
          setItems(parsedItems.length > 0 ? parsedItems : [{ category: '', sub_category: '', quantity: 1, specifications: '' }]);
        } catch (err) {
          toast.error('Failed to load request data');
        }
      };
      fetchRequestForEdit();
    }
  }, [isEdit, requestId]);

  const categories = [...new Set(products.map(p => p.category?.trim()).filter(Boolean))].sort();

  const getSubCategories = (category) => {
    if (!category) return [];
    return [...new Set(
      products.filter(p => p.category?.trim().toUpperCase() === category.toUpperCase())
        .map(p => p.sub_category?.trim()).filter(Boolean)
    )].sort();
  };

  const handleAddItem = () => setItems([...items, { quantity: 1, specifications: '', category: '', sub_category: '' }]);
  const handleRemoveItem = (index) => setItems(items.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.some(item => !item.category)) return toast.error('Please select a category for all items');
    setSubmitting(true);
    try {
      const payload = {
        purpose,
        priority,
        expected_delivery_date: expectedDate || null,
        items: items.map(item => ({
          quantity_requested: item.quantity,
          specifications: { category: item.category, sub_category: item.sub_category || null, notes: item.specifications }
        }))
      };
      if (isEdit && requestId) {
        await api.put(`/requests/${requestId}`, payload);
        toast.success('Request updated successfully');
      } else {
        await api.post('/requests', { request_type: 'new', ...payload });
        toast.success('Request submitted successfully');
      }
      navigate('/dashboard');
    } catch (error) {
      const msg = error.response?.data?.errors?.[0]?.msg || error.response?.data?.message || 'Failed to submit request';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = "w-full h-11 bg-gray-50 border border-gray-200 rounded-lg px-4 text-sm font-medium text-gray-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all";
  const labelClass = "block text-sm font-semibold text-gray-500 mb-2";

  if (!canRequest) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center p-8 bg-red-50 border border-red-100 rounded-2xl">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-3">
          <ShieldAlert size={18} className="text-red-500" />
        </div>
        <h2 className="text-sm font-bold text-gray-900 mb-1">Access Restricted</h2>
        <p className="text-xs text-gray-500 mb-4">You don't have permission to create requests.</p>
        <button onClick={() => navigate('/dashboard')} className="px-4 py-2 text-xs font-medium bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-all">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-2 px-6 space-y-7">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-blue-600 transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
        <span className="text-gray-200">|</span>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center">
            <Send className="text-blue-400" size={16} />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">{isEdit ? 'Edit Resource Request' : 'Request Items'}</h1>
            <p className="text-sm text-gray-400">Submit a new product or resource request</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Items */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-500" />
                <span className="text-sm font-bold text-gray-700">Request Items</span>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div className="p-5 space-y-4">
              {items.map((item, index) => (
                <div key={index} className="p-5 bg-gray-50 border border-gray-100 rounded-xl space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-400">Item #{index + 1}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => handleRemoveItem(index)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-all">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Category <span className="text-red-400">*</span></label>
                      <select
                        className={fieldClass}
                        value={item.category}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].category = e.target.value;
                          newItems[index].sub_category = '';
                          setItems(newItems);
                        }}
                        required
                      >
                        <option value="">Choose category...</option>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Sub-Category <span className="text-gray-300 font-normal">(optional)</span></label>
                      <select
                        className={`${fieldClass} disabled:opacity-40`}
                        value={item.sub_category}
                        disabled={!item.category}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].sub_category = e.target.value;
                          setItems(newItems);
                        }}
                      >
                        <option value="">Any sub-category...</option>
                        {getSubCategories(item.category).map(sub => <option key={sub} value={sub}>{sub}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Qty</label>
                      <input
                        type="number" min="1"
                        className={`${fieldClass} text-center font-bold text-blue-600`}
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].quantity = parseInt(e.target.value) || 1;
                          setItems(newItems);
                        }}
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <label className={labelClass}>Specifications</label>
                      <input
                        type="text"
                        className={fieldClass}
                        value={item.specifications}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].specifications = e.target.value;
                          setItems(newItems);
                        }}
                        placeholder="e.g. 16GB RAM, 512GB SSD"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Details */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
              <ClipboardList size={16} className="text-blue-500" />
              <span className="text-sm font-bold text-gray-700">Request Details</span>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={labelClass}>Purpose / Reason <span className="text-red-400">*</span></label>
                <input
                  type="text" className={fieldClass}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Why do you need this?"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Priority</label>
                <select className={fieldClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="low">Low – Standard</option>
                  <option value="medium">Medium</option>
                  <option value="high">High – Urgent</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Expected Delivery Date</label>
                <input 
                  type="date" 
                  className={fieldClass} 
                  value={expectedDate} 
                  onChange={(e) => setExpectedDate(e.target.value)} 
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => navigate(-1)}
              className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-all shadow-sm">
              {submitting ? 'Submitting...' : isEdit ? 'Save Changes' : 'Submit Request'}
              {!submitting && <ArrowRight size={15} />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default RequestProductPage;
