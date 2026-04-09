import React from "react";

const MockLink = ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => {
  return <a href={href} {...props}>{children}</a>;
};

export default MockLink;
