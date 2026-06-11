import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse, userAgent } from 'next/server';

const auth = NextAuth(authConfig).auth;

export default auth((req) => {
  const { device } = userAgent(req);

  if (device.type === 'mobile') {
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Restricted - zLearner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    @font-face {
      font-family: 'Departure Mono';
      src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2409-1@1.0/DepartureMono-Regular.woff2') format('woff2');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }

    :root {
      --bg-color: #ffffff;
      --accent-color: #3d59c6;
      --text-main: #1e293b;
      --text-muted: #64748b;
      --border-color: rgba(61, 89, 198, 0.7);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background-color: var(--bg-color);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      position: relative;
    }

    /* Retro Grid Background Pattern */
    body::before {
      content: "";
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0.12;
      background-size: 24px 24px;
      background-image: 
        linear-gradient(to right, var(--accent-color) 1px, transparent 1px),
        linear-gradient(to bottom, var(--accent-color) 1px, transparent 1px);
      z-index: 1;
      pointer-events: none;
    }

    .container {
      position: relative;
      z-index: 10;
      max-width: 440px;
      width: 100%;
      background: #ffffff;
      border: 4px dashed var(--border-color);
      border-radius: 16px;
      padding: 3rem 2rem;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(61, 89, 198, 0.1), 0 8px 10px -6px rgba(61, 89, 198, 0.1);
      animation: bounce-in 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .icon-wrapper {
      width: 72px;
      height: 72px;
      background: rgba(61, 89, 198, 0.08);
      border: 3px dashed var(--accent-color);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 2rem;
    }

    .icon {
      width: 36px;
      height: 36px;
      color: var(--accent-color);
    }

    h1 {
      font-family: 'Departure Mono', monospace;
      font-size: 2.25rem;
      font-weight: normal;
      color: var(--accent-color);
      margin-bottom: 1.25rem;
      letter-spacing: -0.03em;
    }

    p {
      font-size: 1.05rem;
      line-height: 1.6;
      color: var(--text-muted);
      margin-bottom: 2rem;
    }

    .strong-highlight {
      color: var(--accent-color);
      font-weight: 700;
    }

    .footer {
      font-family: 'Departure Mono', monospace;
      font-size: 0.85rem;
      color: var(--accent-color);
      opacity: 0.6;
      border-top: 2px dashed rgba(61, 89, 198, 0.2);
      padding-top: 1.5rem;
      margin-top: 0.5rem;
      letter-spacing: 0.05em;
    }

    .footer span {
      font-weight: 700;
      color: var(--accent-color);
    }

    @keyframes bounce-in {
      0% {
        transform: scale(0.9);
        opacity: 0;
      }
      70% {
        transform: scale(1.03);
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon-wrapper">
      <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    </div>
    <h1>Access Restricted_</h1>
    <p>sorry zlearner_ can't be accessed from mobile. Please use a desktop browser to continue.</p>
    <div class="footer">
      zLearner_
    </div>
  </div>
</body>
</html>`,
      {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  return NextResponse.next();
});

export const config = {
  // Apply proxy to all paths except API routes, static files (_next/static, _next/image), and favicon
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
