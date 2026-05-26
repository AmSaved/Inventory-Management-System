import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../layouts/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Mail, Lock } from 'lucide-react';

const schema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().required('Password is required'),
});

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Inventory management system" subtitle>
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Enter your email"
          type="email"
          placeholder="email"
          icon={<Mail className="h-5 w-5 text-slate-400" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Enter your password"
          type="password"
          placeholder=" *********"
          icon={<Lock className="h-5 w-5 text-slate-400" />}
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-200 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-xs text-slate-600 font-medium select-none">
              Remember me
            </label>
          </div>

          <div className="text-xs">
            <Link to="/forgot-password" className="font-semibold text-blue-600 hover:text-blue-500">
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          loading={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-lg shadow-sm hover:shadow transition-all"
        >
          Login
        </Button>

        <p className="text-center text-xs text-slate-400 italic">
          Need access? Contact your system Super Administrator.
        </p>
      </form>
    </AuthLayout>
  );
};

export default LoginPage;