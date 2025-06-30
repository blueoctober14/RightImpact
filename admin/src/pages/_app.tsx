import * as React from 'react';
import Head from 'next/head';
import { CacheProvider, EmotionCache } from '@emotion/react';
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';
import { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import theme from '../styles/theme';
import createEmotionCache from '../utils/createEmotionCache';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';

// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();

interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache;
}

let queryClient: QueryClient;

function MyApp(props: MyAppProps) {
  const { Component, emotionCache = clientSideEmotionCache, pageProps } = props;
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Initialize queryClient in state to ensure it's only created client-side
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      })
  );

  // Set mounted state to true after component mounts (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render anything until we're on the client to prevent hydration mismatches
  if (!mounted) {
    return null;
  }

  return (
    <CacheProvider value={emotionCache}>
      <Head>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AuthProvider>
            <AppContent>
              <Component {...pageProps} key={router.asPath} />
            </AppContent>
          </AuthProvider>
          <ToastContainer position="bottom-right" autoClose={5000} />
          <ReactQueryDevtools initialIsOpen={false} />
        </ThemeProvider>
      </QueryClientProvider>
    </CacheProvider>
  );
}

// Wrap app content with Layout and handle auth state
function AppContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  // Don't render anything while loading auth state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  // For login page, don't use the layout
  if (router.pathname === '/login') {
    return <>{children}</>;
  }

  // For other pages, use the Layout
  return <Layout>{children}</Layout>;
}

export default MyApp;
