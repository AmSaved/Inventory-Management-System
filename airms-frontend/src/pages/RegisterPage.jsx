import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../layouts/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import CascadingUnitSelector from '../components/common/CascadingUnitSelector';
import { Building2, UserPlus, Shield, Mail, User as UserIcon } from 'lucide-react';

const schema = yup.object({
  employee_id: yup.string()
    .required('Employee ID is required'),
  first_name: yup.string()
    .required('First name is required'),
  last_name: yup.string()
    .required('Last name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  confirm_password: yup.string().oneOf([yup.ref('password'), null], 'Passwords must match').required('Confirm password is required'),
  role_id: yup.number().required('Role is required'),
  org_node_id: yup.number().required('Organizational Unit is required'),
  phone: yup.string().required('Phone number is required'),
});

const RegisterPage = () => {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      role_id: 5 // Default to 'User'
    }
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await registerUser(data);
      navigate('/login');
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 5, label: 'Standard User' },
    { value: 4, label: 'Cluster Manager' },
    { value: 3, label: 'Storage Manager' },
    { value: 2, label: 'Company Chairman' },
  ];

  return (
    <AuthLayout title="Infrastructure Onboarding" subtitle="Join the AIRMS enterprise ecosystem.">
      <form className="space-y-8" onSubmit={handleSubmit(onSubmit)}>
        {/* Identity Group */}
        <div className="space-y-4">
           <div className="flex items-center gap-2 mb-4">
              <UserIcon size={14} className="text-blue-500" />
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Identity Profile</h3>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Personnel ID"
                placeholder="EMP-0000"
                error={errors.employee_id?.message}
                {...register('employee_id')}
                className="h-12 rounded-2xl"
              />
              <Input
                label="First Name"
                placeholder="John"
                error={errors.first_name?.message}
                {...register('first_name')}
                className="h-12 rounded-2xl"
              />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Last Name"
                placeholder="Doe"
                error={errors.last_name?.message}
                {...register('last_name')}
                className="h-12 rounded-2xl"
              />
              <Input
                label="Email"
                type="email"
                placeholder="john.doe@company.com"
                error={errors.email?.message}
                {...register('email')}
                className="h-12 rounded-2xl"
              />
              <Input
                label="Phone Number"
                placeholder="+254 700 000 000"
                error={errors.phone?.message}
                {...register('phone')}
                className="h-12 rounded-2xl"
              />
           </div>
        </div>

        {/* Access Hierarchy Group */}
        <div className="space-y-4">
           <div className="flex items-center gap-2 mb-4">
              <Building2 size={14} className="text-blue-500" />
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Hierarchy Position</h3>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Assigned Unit</label>
                 <Controller
                    name="org_node_id"
                    control={control}
                    render={({ field }) => (
                      <CascadingUnitSelector 
                        value={field.value}
                        onChange={field.onChange}
                        className={`h-12 rounded-2xl ${errors.org_node_id ? 'border-red-500' : ''}`}
                      />
                    )}
                 />
                 {errors.org_node_id && <p className="text-xs text-red-500 mt-1">{errors.org_node_id.message}</p>}
              </div>
              <Select
                label="Target Role"
                options={roleOptions}
                error={errors.role_id?.message}
                {...register('role_id')}
                className="h-12 rounded-2xl"
              />
           </div>
        </div>

        {/* Security Group */}
        <div className="space-y-4">
           <div className="flex items-center gap-2 mb-4">
              <Shield size={14} className="text-blue-500" />
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Security Credentials</h3>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Set Password"
                type="password"
                placeholder="********"
                error={errors.password?.message}
                {...register('password')}
                className="h-12 rounded-2xl"
              />
              <Input
                label="Confirm Credentials"
                type="password"
                placeholder="********"
                error={errors.confirm_password?.message}
                {...register('confirm_password')}
                className="h-12 rounded-2xl"
              />
           </div>
        </div>

        <div className="pt-4">
          <Button 
            type="submit" 
            loading={loading} 
            className="w-full bg-slate-900 h-16 rounded-[25px] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-4 group"
          >
            Create Infinite Identity <UserPlus className="group-hover:scale-110 transition-transform" />
          </Button>
        </div>

        <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
          Already Part of the Matrix?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-500 transition-colors">
            Authorize Access
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default RegisterPage;