import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-4">
      <div className="container mx-auto px-4">
        <div className="text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} AIRMS - Asset & Inventory Request Management System. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;