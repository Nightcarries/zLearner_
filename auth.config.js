export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      const isOnReader = nextUrl.pathname.startsWith('/reader');

      if (isOnDashboard || isOnReader) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      let currentBaseUrl = baseUrl;
      if (process.env.VERCEL_URL) {
        currentBaseUrl = `https://${process.env.VERCEL_URL}`;
      }

      if (url.startsWith("/")) {
        return `${currentBaseUrl}${url}`;
      }

      try {
        const parsedUrl = new URL(url);
        const parsedBase = new URL(currentBaseUrl);
        if (parsedUrl.origin === parsedBase.origin) {
          return url;
        }
      } catch (e) {
        // Fallback
      }

      return currentBaseUrl;
    },
  },
  providers: [], // Required empty array for base config
};
