import React from 'react';
import Header from './Header';

const Layout = ({ children }) => {
  return (
    <div>
      <Header />
      <div className="container mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
};

export default Layout; 