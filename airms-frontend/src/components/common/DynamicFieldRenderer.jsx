import React from 'react';
import Input from '../ui/Input';
import { motion } from 'framer-motion';

const DynamicFieldRenderer = ({ schema, values, onChange, errors = {} }) => {
    if (!schema || !Array.isArray(schema)) return null;

    // Group fields by section
    const sections = schema.reduce((acc, field) => {
        const sectionName = field.section || 'General Specifications';
        if (!acc[sectionName]) acc[sectionName] = [];
        acc[sectionName].push(field);
        return acc;
    }, {});

    const renderField = (field) => {
        const commonProps = {
            label: field.label,
            value: values[field.key] || '',
            onChange: (e) => onChange(field.key, e.target.value),
            error: errors[field.key],
            required: field.required,
            placeholder: `Enter ${field.label.toLowerCase()}...`,
            className: "h-14 bg-slate-50 border-none rounded-2xl font-bold px-6 focus:ring-2 ring-indigo-500/20",
            // Add unit as a suffix if it exists
            suffix: field.unit ? (
                <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest mr-2">
                    {field.unit}
                </span>
            ) : null
        };

        switch (field.type) {
            case 'number':
                return (
                    <div className="relative">
                        <Input 
                            {...commonProps} 
                            type="number" 
                        />
                        {field.unit && (
                            <div className="absolute right-4 top-[38px] flex items-center pointer-events-none">
                                <span className="bg-slate-200 text-slate-500 px-2 py-0.5 rounded text-[8px] font-black uppercase">
                                    {field.unit}
                                </span>
                            </div>
                        )}
                    </div>
                );
            
            case 'date':
                return <Input {...commonProps} type="date" />;
            
            case 'select':
                return (
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                            {field.label} {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        <select 
                            className="w-full h-14 bg-slate-50 border-none rounded-2xl px-6 font-bold text-slate-900 outline-none focus:ring-2 ring-indigo-500/20 appearance-none cursor-pointer"
                            value={values[field.key] || ''}
                            onChange={(e) => onChange(field.key, e.target.value)}
                        >
                            <option value="">Select an option...</option>
                            {(field.options || []).map((opt, i) => (
                                <option key={i} value={opt}>{opt}</option>
                            ))}
                        </select>
                        {errors[field.key] && <p className="text-[10px] font-bold text-rose-500 ml-4">{errors[field.key]}</p>}
                    </div>
                );

            case 'textarea':
                return (
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                            {field.label} {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        <textarea 
                            className="w-full min-h-[120px] p-6 bg-slate-50 border-none rounded-[2rem] font-bold text-slate-900 outline-none focus:ring-2 ring-indigo-500/20 resize-none"
                            placeholder={commonProps.placeholder}
                            value={values[field.key] || ''}
                            onChange={(e) => onChange(field.key, e.target.value)}
                        />
                    </div>
                );

            case 'checkbox':
                return (
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all cursor-pointer" onClick={() => onChange(field.key, !values[field.key])}>
                        <div className={`w-10 h-6 rounded-full p-1 transition-all ${values[field.key] ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full transition-all ${values[field.key] ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                        <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{field.label}</span>
                    </div>
                );

            default:
                return <Input {...commonProps} type="text" />;
        }
    };

    return (
        <div className="space-y-12">
            {Object.entries(sections).map(([name, fields]) => (
                <motion.div 
                    key={name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    <div className="flex items-center gap-4 px-2">
                        <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">{name}</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {fields.map(field => (
                            <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                                {renderField(field)}
                            </div>
                        ))}
                    </div>
                </motion.div>
            ))}
        </div>
    );
};

export default DynamicFieldRenderer;
