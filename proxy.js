import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  // Apply proxy to all paths except API routes, static files (_next/static, _next/image), and favicon
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
